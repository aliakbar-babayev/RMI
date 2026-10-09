"""Checks that evidence quotes really appear in the source text.

Matching ignores case and differences in whitespace only. Any other change by the
model (translation, paraphrase, edited words) makes the quote fail.
"""

import unicodedata

# Quote marks the model often wraps around a quote; they are not part of the evidence.
_WRAPPERS = "\"'«»“”„‘’`"


def _normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Return the normalized text and, for each normalized char, its index in `text`."""
    out: list[str] = []
    index_map: list[int] = []
    prev_space = True  # also strips leading whitespace
    for i, ch in enumerate(text):
        if ch.isspace():
            if not prev_space:
                out.append(" ")
                index_map.append(i)
            prev_space = True
            continue
        prev_space = False
        for c in unicodedata.normalize("NFKC", ch).casefold():
            # Azerbaijani/Turkish dotted İ casefolds to "i" + combining dot, and I/ı do not pair
            # up; fold all of them to plain "i" so case differences in these letters still match.
            if c == "̇":
                continue
            out.append("i" if c == "ı" else c)
            index_map.append(i)
    if out and out[-1] == " ":
        out.pop()
        index_map.pop()
    return "".join(out), index_map


def normalize(text: str) -> str:
    return _normalize_with_map(text)[0]


def locate_quote(source: str, quote: str) -> tuple[int, int] | None:
    """Return (start, end) offsets of `quote` in `source`, or None if it is not there."""
    needle = normalize(quote.strip().strip(_WRAPPERS))
    if not needle:
        return None
    haystack, index_map = _normalize_with_map(source)
    pos = haystack.find(needle)
    if pos < 0:
        return None
    return index_map[pos], index_map[pos + len(needle) - 1] + 1
