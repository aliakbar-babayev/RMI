import { useId, useMemo } from 'react'
import type { HeatCell } from '../lib/api'
import { LEVEL, levelFor } from '../lib/labels'
import { cx } from './ui'

const ROWS = ['1: Very low', '2: Low', '3: Medium', '4: High', '5: Very high']
const COLS = ['1: Rare', '2: Unlikely', '3: Possible', '4: Likely', '5: Certain']

// Cold → hot. Blue where there is little risk, a pale midpoint, red where risk piles up.
const STOPS: [number, [number, number, number]][] = [
  [0, [96, 165, 250]], // #60a5fa cold blue
  [0.4, [224, 231, 255]], // #e0e7ff pale midpoint
  [0.7, [252, 165, 165]], // #fca5a5 warm
  [1, [220, 38, 38]], // #dc2626 hot red
]

export function heatColor(t: number) {
  const x = Math.max(0, Math.min(1, t))
  for (let k = 1; k < STOPS.length; k++) {
    const [t1, c1] = STOPS[k]
    const [t0, c0] = STOPS[k - 1]
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0)
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * f))
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
  }
  return 'rgb(220,38,38)'
}

const CELL = 100 // SVG units per cell; the 5×5 field is 500×500

/**
 * Thermal risk map. Heat of a cell = number of risks × its P×I score, spread a little into
 * neighbouring cells and blurred, so concentrations read as a red wave and quiet areas as
 * cold blue. Counts stay printed on top, so color is never the only signal.
 */
export function HeatMap({ cells, selected, onSelect }: {
  cells: HeatCell[]
  selected: HeatCell | null
  onSelect: (c: HeatCell | null) => void
}) {
  const uid = useId().replace(/:/g, '')
  const at = (p: number, i: number) => cells.find((c) => c.p === p && c.i === i) ?? { p, i, open: 0, total: 0, risk_ids: [] }

  const { heat, max } = useMemo(() => {
    const raw = new Map<string, number>()
    for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) raw.set(`${p}-${i}`, at(p, i).total * p * i)
    const smooth = new Map<string, number>()
    let m = 0
    for (let p = 1; p <= 5; p++)
      for (let i = 1; i <= 5; i++) {
        let v = raw.get(`${p}-${i}`)!
        for (const [dp, di] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) v += 0.3 * (raw.get(`${p + dp}-${i + di}`) ?? 0)
        smooth.set(`${p}-${i}`, v)
        m = Math.max(m, v)
      }
    return { heat: smooth, max: m }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells])

  const t = (p: number, i: number) => (max ? heat.get(`${p}-${i}`)! / max : 0)
  // x = probability (left→right), y = impact (bottom→top)
  const pos = (p: number, i: number) => ({ x: (p - 1) * CELL, y: (5 - i) * CELL })

  return (
    <div>
      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[84px_minmax(0,1fr)]">
        <div className="grid grid-rows-5">
          {[5, 4, 3, 2, 1].map((i) => (
            <div key={i} className="flex items-center font-mono text-[11px] leading-tight text-ink-2">{ROWS[i - 1]}</div>
          ))}
        </div>

        <div className="relative h-[300px] overflow-hidden rounded-md sm:h-[340px]">
          <svg viewBox="0 0 500 500" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <filter id={`blur-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="38" />
              </filter>
              <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="22" />
              </filter>
            </defs>
            {/* cold base so the blurred edges never fade to white */}
            <rect width="500" height="500" fill={heatColor(0)} />
            {/* smooth field: every cell painted with its heat, then blurred into its neighbours */}
            <g filter={`url(#blur-${uid})`}>
              {[1, 2, 3, 4, 5].flatMap((p) =>
                [1, 2, 3, 4, 5].map((i) => {
                  const { x, y } = pos(p, i)
                  return <rect key={`${p}-${i}`} x={x - 10} y={y - 10} width={CELL + 20} height={CELL + 20} fill={heatColor(t(p, i))} />
                }),
              )}
            </g>
            {/* hot spots: soft red blobs that pulse where risk is concentrated */}
            <g filter={`url(#glow-${uid})`}>
              {[1, 2, 3, 4, 5].flatMap((p) =>
                [1, 2, 3, 4, 5].map((i) => {
                  const v = t(p, i)
                  if (v < 0.55 || at(p, i).total === 0) return null
                  const { x, y } = pos(p, i)
                  return (
                    <circle key={`h${p}-${i}`} cx={x + CELL / 2} cy={y + CELL / 2} r={22 + v * 30} fill={heatColor(1)} opacity={0.35 + v * 0.45} className="heat-pulse" style={{ transformOrigin: `${x + CELL / 2}px ${y + CELL / 2}px` }} />
                  )
                }),
              )}
            </g>
            {/* faint grid so the 25 cells stay readable */}
            {[1, 2, 3, 4].map((k) => (
              <g key={k} stroke="white" strokeOpacity="0.55" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                <line x1={k * CELL} y1="0" x2={k * CELL} y2="500" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1={k * CELL} x2="500" y2={k * CELL} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>

          <div className="absolute inset-0 grid grid-cols-5 grid-rows-5">
            {[5, 4, 3, 2, 1].map((i) =>
              [1, 2, 3, 4, 5].map((p) => {
                const c = at(p, i)
                const isSel = selected?.p === p && selected?.i === i
                return (
                  <button
                    key={`${p}-${i}`}
                    type="button"
                    disabled={c.total === 0}
                    onClick={() => onSelect(isSel ? null : c)}
                    title={`${p}×${i}=${p * i} (${LEVEL[levelFor(p * i)]}) · ${c.total} risks, ${c.open} open`}
                    aria-label={`Probability ${p}, impact ${i}, score ${p * i}: ${c.total} risks, ${c.open} open`}
                    className={cx(
                      'relative flex items-center justify-center transition',
                      c.total > 0 ? 'cursor-pointer hover:bg-white/15' : 'cursor-default',
                      isSel && 'ring-2 ring-ink ring-inset',
                    )}
                  >
                    {c.total > 0 && (
                      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/90 px-1.5 font-mono text-[13px] font-semibold text-ink shadow-sm">
                        {c.total}
                      </span>
                    )}
                  </button>
                )
              }),
            )}
          </div>
        </div>

        <div />
        <div className="grid grid-cols-5 pt-1">
          {COLS.map((l) => (
            <div key={l} className="text-center font-mono text-[10px] leading-tight text-ink-2 sm:text-[11px]">{l}</div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[11px] text-ink-2">
        <span>↑ Impact · Probability →</span>
        <span className="ml-auto inline-flex items-center gap-2">
          Cold: little risk
          <span className="h-2.5 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.4, 0.7, 1].map((x) => heatColor(x)).join(',')})` }} />
          Hot: concentrated risk
        </span>
      </div>
    </div>
  )
}
