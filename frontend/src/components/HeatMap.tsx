import type { HeatCell, Level } from '../lib/api'
import { LEVEL, levelFor } from '../lib/labels'
import { LEVEL_SOLID, cx } from './ui'

const TINT: Record<Level, string> = {
  low: 'bg-lvl-low-soft',
  medium: 'bg-lvl-medium-soft',
  high: 'bg-lvl-high-soft',
  critical: 'bg-lvl-critical-soft',
}
const ROWS = ['1: Very low', '2: Low', '3: Medium', '4: High', '5: Very high']
const COLS = ['1: Rare', '2: Unlikely', '3: Possible', '4: Likely', '5: Certain']

/**
 * Probability × Impact matrix. Each cell shows its P×I product and, when it holds risks,
 * a count badge in the zone's color, so color is never the only signal.
 */
export function HeatMap({ cells, selected, onSelect }: {
  cells: HeatCell[]
  selected: HeatCell | null
  onSelect: (c: HeatCell | null) => void
}) {
  const at = (p: number, i: number) => cells.find((c) => c.p === p && c.i === i) ?? { p, i, open: 0, total: 0, risk_ids: [] }

  return (
    <div>
      <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-[3px] sm:grid-cols-[84px_repeat(5,minmax(0,1fr))]">
        {[5, 4, 3, 2, 1].map((i) => (
          <div key={i} className="contents">
            <div className="flex items-center pr-2 font-mono text-[11px] leading-tight text-ink-2">{ROWS[i - 1]}</div>
            {[1, 2, 3, 4, 5].map((p) => {
              const c = at(p, i)
              const level = levelFor(p * i)
              const isSel = selected?.p === p && selected?.i === i
              return (
                <button
                  key={p}
                  type="button"
                  disabled={c.total === 0}
                  onClick={() => onSelect(isSel ? null : c)}
                  title={`${p}×${i}=${p * i} · ${LEVEL[level]} · ${c.total} risks (${c.open} open)`}
                  aria-label={`Probability ${p}, impact ${i}, score ${p * i} (${LEVEL[level]}): ${c.total} risks, ${c.open} open`}
                  className={cx(
                    'relative flex h-14 items-center justify-center rounded-sm transition sm:h-16',
                    TINT[level],
                    c.total > 0 ? 'cursor-pointer hover:ring-1 hover:ring-ink' : 'opacity-70',
                    isSel && 'ring-2 ring-ink',
                  )}
                >
                  <span className="absolute top-1 left-1.5 font-mono text-[10px] text-ink-2">
                    {p}×{i}={p * i}
                  </span>
                  {c.total > 0 ? (
                    <span className={cx('flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-mono text-[12px] font-semibold', LEVEL_SOLID[level])}>
                      {c.total}
                    </span>
                  ) : (
                    <span className="font-mono text-[12px] text-ink-3">–</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
        <div />
        {COLS.map((l) => (
          <div key={l} className="pt-1 text-center font-mono text-[10px] leading-tight text-ink-2 sm:text-[11px]">
            {l}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-ink-2">
        <span>↑ Impact</span>
        <span>Probability →</span>
      </div>
    </div>
  )
}
