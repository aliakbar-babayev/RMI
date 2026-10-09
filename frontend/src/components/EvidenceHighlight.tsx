import type React from 'react';
import { S } from '../strings';
import type { Evidence } from '../types';

interface Props {
  text: string;
  evidence: Evidence[];
}

interface Span {
  start: number;
  end: number;
  verified: boolean;
}

export default function EvidenceHighlight({ text, evidence }: Props) {
  const spans: Span[] = evidence
    .filter((e) => e.start != null && e.end != null)
    .map((e) => ({ start: e.start!, end: e.end!, verified: e.verified }))
    .sort((a, b) => a.start - b.start);

  if (spans.length === 0) {
    return <p className="text-sm text-[var(--c-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">{text}</p>;
  }

  const parts: React.ReactElement[] = [];
  let cursor = 0;

  for (const span of spans) {
    const start = Math.max(span.start, cursor);
    const end = Math.min(span.end, text.length);
    if (start >= end) continue;

    if (cursor < start) {
      parts.push(<span key={`t-${cursor}`} className="text-[var(--c-text-secondary)]">{text.slice(cursor, start)}</span>);
    }

    parts.push(
      <mark
        key={`m-${start}`}
        className="bg-[var(--c-mark)] text-[var(--c-primary)] rounded px-0.5 border-b border-[var(--c-primary-border)]"
        title={span.verified ? S.risk.verified : S.risk.unverified}
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }

  if (cursor < text.length) {
    parts.push(<span key={`t-${cursor}`} className="text-[var(--c-text-secondary)]">{text.slice(cursor)}</span>);
  }

  return <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{parts}</p>;
}
