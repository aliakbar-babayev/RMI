import { useCallback, useState } from 'react';
import { getRisks } from '../api';
import RiskDrawer from '../components/RiskDrawer';
import RiskRow from '../components/RiskRow';
import { usePolling } from '../hooks/usePolling';
import { S } from '../strings';
import type { Risk } from '../types';

interface ActionData {
  pending: Risk[];
  needsReview: Risk[];
}

export default function ActionCenterPage() {
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  const fetcher = useCallback(async (): Promise<ActionData> => {
    const [pending, needsReview] = await Promise.all([
      getRisks({ status: 'pending' }),
      getRisks({ needs_review: 'true' }),
    ]);
    const pendingIds = new Set(pending.map((r) => r.risk_id));
    const dedupedReview = needsReview.filter((r) => !pendingIds.has(r.risk_id));
    return { pending, needsReview: dedupedReview };
  }, []);

  const { data, loading, refresh } = usePolling(fetcher, 5000);

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

  const pending = data?.pending ?? [];
  const needsReview = data?.needsReview ?? [];
  const isEmpty = pending.length === 0 && needsReview.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">{S.actions.title}</h1>

      {isEmpty && (
        <p className="text-[var(--c-text-secondary)] text-sm py-8 text-center">{S.actions.empty}</p>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--c-text-secondary)] mb-3">{S.actions.pendingSection} ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((r) => (
              <RiskRow key={r.risk_id} risk={r} onClick={() => setSelectedRisk(r)} />
            ))}
          </div>
        </div>
      )}

      {needsReview.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--c-text-secondary)] mb-3">{S.actions.reviewSection} ({needsReview.length})</h2>
          <div className="space-y-2">
            {needsReview.map((r) => (
              <RiskRow key={r.risk_id} risk={r} onClick={() => setSelectedRisk(r)} />
            ))}
          </div>
        </div>
      )}

      {selectedRisk && (
        <RiskDrawer risk={selectedRisk} onClose={() => setSelectedRisk(null)} onUpdate={handleRiskUpdate} />
      )}
    </div>
  );
}
