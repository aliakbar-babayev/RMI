import pytest

from app.models.schemas import Classification, Level
from app.services import scorer
from app.services.verifier import locate_quote


@pytest.mark.parametrize(
    ("score", "level"),
    [(1, Level.low), (4, Level.low), (5, Level.medium), (9, Level.medium),
     (10, Level.high), (15, Level.high), (16, Level.critical), (25, Level.critical)],
)
def test_level_boundaries(score, level):
    assert scorer.level_for(score) == level


def test_score_is_p_times_i():
    assert scorer.compute_score(4, 5) == 20


def test_issue_has_full_probability():
    assert scorer.effective_probability(Classification.issue, 2) == 5
    assert scorer.effective_probability(Classification.risk, 2) == 2


def test_needs_review():
    assert scorer.needs_review(0.69, True)
    assert scorer.needs_review(0.95, False)
    assert not scorer.needs_review(0.7, True)


SOURCE = "Line one.\nThe vendor   still has not delivered\nthe sandbox API.  Ödəniş modulu gecikdirilib."


def test_quote_matches_ignoring_case_and_whitespace():
    span = locate_quote(SOURCE, "the VENDOR still has not delivered the sandbox api")
    assert span
    assert SOURCE[span[0]:span[1]] == "The vendor   still has not delivered\nthe sandbox API"


def test_quote_with_wrapping_quote_marks():
    assert locate_quote(SOURCE, "«Ödəniş modulu gecikdirilib.»")


def test_azerbaijani_dotted_and_dotless_i():
    assert locate_quote(SOURCE, "ÖDƏNİŞ MODULU GECİKDİRİLİB")
    assert locate_quote("Qız məktəbə getdi.", "QIZ MƏKTƏBƏ")


def test_russian_case_insensitive():
    assert locate_quote("Поставщик сообщил о задержке.", "ПОСТАВЩИК СООБЩИЛ")


def test_edited_or_translated_quote_fails():
    assert locate_quote(SOURCE, "The vendor has not delivered the sandbox API") is None
    assert locate_quote(SOURCE, "Ödəniş modulu iki həftə gecikdirilib") is None
    assert locate_quote(SOURCE, "   ") is None
