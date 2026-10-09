import type { HeatmapCell } from '../types';

function zoneColor(score: number): string {
  if (score >= 16) return 'bg-[var(--c-red-bg)] text-[var(--c-red)] border-[var(--c-red)]/20';
  if (score >= 10) return 'bg-[var(--c-orange-bg)] text-[var(--c-orange)] border-[var(--c-orange)]/20';
  if (score >= 5) return 'bg-[var(--c-yellow-bg)] text-[var(--c-yellow)] border-[var(--c-yellow)]/20';
  return 'bg-[var(--c-green-bg)] text-[var(--c-green)] border-[var(--c-green)]/20';
}

interface Props {
  cells: HeatmapCell[];
  onCellClick: (riskIds: string[]) => void;
}

export default function HeatMap({ cells, onCellClick }: Props) {
  const cellMap = new Map<string, HeatmapCell>();
  for (const c of cells) cellMap.set(`${c.p}-${c.i}`, c);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse w-full min-w-[320px]">
        <thead>
          <tr>
            <th className="w-10 text-[10px] tracking-wider uppercase text-[var(--c-text-muted)] font-medium p-1">P\I</th>
            {[1, 2, 3, 4, 5].map((i) => (
              <th key={i} className="text-[10px] tracking-wider uppercase text-[var(--c-text-muted)] font-medium p-1 text-center">{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((p) => (
            <tr key={p}>
              <td className="text-[10px] tracking-wider uppercase text-[var(--c-text-muted)] font-medium p-1 text-center">{p}</td>
              {[1, 2, 3, 4, 5].map((i) => {
                const cell = cellMap.get(`${p}-${i}`);
                const score = p * i;
                const open = cell?.open ?? 0;
                const total = cell?.total ?? 0;
                const hasRisks = total > 0;
                return (
                  <td key={i} className="p-1">
                    <button
                      type="button"
                      onClick={() => hasRisks && onCellClick(cell?.risk_ids ?? [])}
                      disabled={!hasRisks}
                      className={`w-full aspect-square rounded-lg border flex flex-col items-center justify-center text-xs font-medium transition-all duration-200 ${zoneColor(score)} ${hasRisks ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'opacity-40 cursor-default'}`}
                      aria-label={`P${p} I${i}: ${open} open of ${total}`}
                    >
                      <span className="font-bold text-sm">{open}</span>
                      {total > 0 && <span className="text-[9px] opacity-60">{open}/{total}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between text-[9px] tracking-wider uppercase text-[var(--c-text-muted)] mt-2 px-1">
        <span>← Low impact</span>
        <span>High impact →</span>
      </div>
    </div>
  );
}
