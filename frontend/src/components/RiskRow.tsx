import { S } from '../strings';
import type { Risk } from '../types';

const LEVEL_COLORS: Record<string, string> = {
  low: 'bg-[var(--c-green-bg)] text-[var(--c-green)] border border-[var(--c-green)]/20',
  medium: 'bg-[var(--c-yellow-bg)] text-[var(--c-yellow)] border border-[var(--c-yellow)]/20',
  high: 'bg-[var(--c-orange-bg)] text-[var(--c-orange)] border border-[var(--c-orange)]/20',
  critical: 'bg-[var(--c-red-bg)] text-[var(--c-red)] border border-[var(--c-red)]/20',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[var(--c-yellow-bg)] text-[var(--c-yellow)] border border-[var(--c-yellow)]/20',
  approved: 'bg-[var(--c-green-bg)] text-[var(--c-green)] border border-[var(--c-green)]/20',
  edited: 'bg-[var(--c-yellow-bg)] text-[var(--c-yellow)] border border-[var(--c-yellow)]/20',
  rejected: 'bg-[var(--c-red-bg)] text-[var(--c-red)] border border-[var(--c-red)]/20',
  escalated: 'bg-[var(--c-orange-bg)] text-[var(--c-orange)] border border-[var(--c-orange)]/20',
  resolved: 'bg-[var(--c-green-bg)] text-[var(--c-green)] border border-[var(--c-green)]/20',
};

interface Props {
  risk: Risk;
  onClick?: () => void;
}

export default function RiskRow({ risk, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4 hover:border-[var(--c-primary-border)] hover:bg-[var(--c-surface-hover)] transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center gap-3 group"
    >
      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm shrink-0 ${LEVEL_COLORS[risk.level]}`}>
        {risk.score}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--c-text)] break-words group-hover:text-[var(--c-primary)] transition-colors">{risk.statement}</p>
        <div className="flex flex-wrap gap-2 mt-1.5">
          <span className="text-[10px] tracking-wider uppercase text-[var(--c-text-muted)] font-medium">{risk.category}</span>
          {risk.source && <span className="text-[10px] tracking-wider uppercase text-[var(--c-text-muted)]">· {risk.source}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded font-medium ${STATUS_COLORS[risk.status]}`}>
          {risk.status}
        </span>
        <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-[var(--c-bg-subtle)] text-[var(--c-text-secondary)] border border-[var(--c-border)]">
          {risk.classification}
        </span>
        {risk.needs_review && (
          <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-[var(--c-orange-bg)] text-[var(--c-orange)] border border-[var(--c-orange)]/20 font-medium">
            {S.risk.needsReview}
          </span>
        )}
      </div>
    </button>
  );
}

export { LEVEL_COLORS, STATUS_COLORS };
