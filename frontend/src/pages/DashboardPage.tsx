import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHeatmap, getInsights, getKPIs, getRisk, getTopRisks } from '../api';
import HeatMap from '../components/HeatMap';
import RiskDrawer from '../components/RiskDrawer';
import RiskRow from '../components/RiskRow';
import { usePolling } from '../hooks/usePolling';
import { S } from '../strings';
import type { HeatmapData, InsightsData, KPIs, Risk } from '../types';

interface DashboardData {
  kpis: KPIs;
  heatmap: HeatmapData;
  top: Risk[];
  insights: InsightsData;
}

export default function DashboardPage() {
  const [heatMode, setHeatMode] = useState<'all' | 'open'>('all');
  const [heatSource, setHeatSource] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [cellRisks, setCellRisks] = useState<Risk[] | null>(null);

  const fetcher = useCallback(async (): Promise<DashboardData> => {
    const [kpis, heatmap, top, insights] = await Promise.all([
      getKPIs(),
      getHeatmap(heatMode, heatSource || undefined),
      getTopRisks(),
      getInsights(),
    ]);
    return { kpis, heatmap, top, insights };
  }, [heatMode, heatSource]);

  const { data, loading, refresh } = usePolling(fetcher, 5000);

  const handleCellClick = async (riskIds: string[]) => {
    if (riskIds.length === 0) return;
    try {
      const risks = await Promise.all(riskIds.map(getRisk));
      setCellRisks(risks);
    } catch { /* ignore */ }
  };

  const handleRiskUpdate = (updated: Risk) => {
    setSelectedRisk(updated);
    refresh();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[var(--c-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.kpis.total === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">{S.dashboard.title}</h1>
        <p className="text-[var(--c-text-secondary)] mb-4">{S.dashboard.empty}</p>
        <Link to="/" className="text-sm text-[var(--c-primary)] hover:underline">{S.dashboard.emptyAction}</Link>
      </div>
    );
  }

  const { kpis, heatmap, top, insights } = data;

  const kpiCards: { label: string; value: number; color: string }[] = [
    { label: S.dashboard.kpis.open, value: kpis.open, color: 'var(--c-primary)' },
    { label: S.dashboard.kpis.critical, value: kpis.critical, color: 'var(--c-red)' },
    { label: S.dashboard.kpis.needsReview, value: kpis.needs_review, color: 'var(--c-orange)' },
    { label: S.dashboard.kpis.escalated, value: kpis.escalated, color: 'var(--c-yellow)' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">{S.dashboard.title}</h1>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4">
            <p className="text-sm text-[var(--c-text-secondary)]">{k.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Heat Map + Top Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold">{S.dashboard.heatmap.title}</h2>
            <div className="flex items-center gap-2">
              <select
                value={heatMode}
                onChange={(e) => setHeatMode(e.target.value as 'all' | 'open')}
                className="text-xs border border-[var(--c-border)] rounded px-2 py-1 bg-[var(--c-bg)] text-[var(--c-text)]"
              >
                <option value="all">{S.dashboard.heatmap.modeAll}</option>
                <option value="open">{S.dashboard.heatmap.modeOpen}</option>
              </select>
              <select
                value={heatSource}
                onChange={(e) => setHeatSource(e.target.value)}
                className="text-xs border border-[var(--c-border)] rounded px-2 py-1 bg-[var(--c-bg)] text-[var(--c-text)]"
              >
                <option value="">{S.dashboard.heatmap.allSources}</option>
                {heatmap.sources.map((s) => (
                  <option key={s.source} value={s.source}>{s.source}</option>
                ))}
              </select>
            </div>
          </div>
          <HeatMap cells={heatmap.cells} onCellClick={handleCellClick} />

          {/* Source table */}
          {heatmap.sources.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--c-text-secondary)] border-b border-[var(--c-border)]">
                    <th className="text-left py-1 font-medium">{S.dashboard.sourceTable.source}</th>
                    <th className="text-right py-1 font-medium">{S.dashboard.sourceTable.total}</th>
                    <th className="text-right py-1 font-medium">{S.dashboard.sourceTable.open}</th>
                    <th className="text-right py-1 font-medium">{S.dashboard.sourceTable.solved}</th>
                    <th className="text-right py-1 font-medium">{S.dashboard.sourceTable.exposure}</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmap.sources.map((s) => (
                    <tr key={s.source} className="border-b border-[var(--c-border)]">
                      <td className="py-1">{s.source}</td>
                      <td className="text-right py-1">{s.total}</td>
                      <td className="text-right py-1">{s.open}</td>
                      <td className="text-right py-1">{s.solved}</td>
                      <td className="text-right py-1">{s.open_exposure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">{S.dashboard.top.title}</h2>
          <div className="space-y-2">
            {top.map((r) => (
              <RiskRow key={r.risk_id} risk={r} onClick={() => setSelectedRisk(r)} />
            ))}
            {top.length === 0 && <p className="text-sm text-[var(--c-text-secondary)]">{S.dashboard.empty}</p>}
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.insights.length > 0 && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{S.dashboard.insights.title}</h2>
            <span className="text-xs text-[var(--c-text-secondary)] bg-[var(--c-bg)] px-2 py-0.5 rounded">
              {S.dashboard.insights.generatedBy(insights.generated_by)}
            </span>
          </div>
          <ul className="space-y-2">
            {insights.insights.map((ins, idx) => (
              <li key={idx} className="text-sm text-[var(--c-text)] break-words">
                {ins.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cell risks modal */}
      {cellRisks && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setCellRisks(null)} />
          <div className="fixed inset-x-4 top-20 bottom-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg z-50 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Risks in this cell</h3>
              <button onClick={() => setCellRisks(null)} className="text-[var(--c-text-secondary)] hover:text-[var(--c-text)]" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {cellRisks.map((r) => (
              <RiskRow key={r.risk_id} risk={r} onClick={() => { setCellRisks(null); setSelectedRisk(r); }} />
            ))}
          </div>
        </>
      )}

      {selectedRisk && (
        <RiskDrawer risk={selectedRisk} onClose={() => setSelectedRisk(null)} onUpdate={handleRiskUpdate} />
      )}
    </div>
  );
}
