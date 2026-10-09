import { useCallback, useState } from 'react';
import { getAuditLog, getErrorMessage, verifyAudit } from '../api';
import { usePolling } from '../hooks/usePolling';
import { S } from '../strings';
import type { AuditEntry } from '../types';

export default function AuditPage() {
  const [verifyState, setVerifyState] = useState<{ loading: boolean; result: string; ok: boolean | null }>({
    loading: false, result: '', ok: null,
  });

  const fetcher = useCallback(() => getAuditLog(undefined, 200), []);
  const { data: entries, loading } = usePolling<AuditEntry[]>(fetcher, 10000);

  const handleVerify = async () => {
    setVerifyState({ loading: true, result: '', ok: null });
    try {
      const r = await verifyAudit();
      setVerifyState({
        loading: false,
        ok: r.ok,
        result: r.ok ? S.auditLog.verifyOk(r.checked) : S.auditLog.verifyBroken(r.broken_at!),
      });
    } catch (err) {
      setVerifyState({ loading: false, ok: false, result: getErrorMessage(err) });
    }
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  if (loading && !entries) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[var(--c-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{S.auditLog.title}</h1>
        <button
          onClick={handleVerify}
          disabled={verifyState.loading}
          className="px-4 py-1.5 bg-[var(--c-primary)] text-white rounded text-sm font-medium hover:bg-[var(--c-primary-hover)] disabled:opacity-50"
        >
          {verifyState.loading ? S.auditLog.verifying : S.auditLog.verify}
        </button>
      </div>

      {verifyState.result && (
        <div className={`text-sm px-4 py-3 rounded ${verifyState.ok ? 'bg-[var(--c-green-bg)] text-[var(--c-green)]' : 'bg-[var(--c-red-bg)] text-[var(--c-red)]'}`}>
          {verifyState.result}
        </div>
      )}

      <div className="overflow-x-auto bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--c-border)] text-[var(--c-text-secondary)]">
              <th className="text-left px-4 py-2 font-medium">{S.auditLog.columns.time}</th>
              <th className="text-left px-4 py-2 font-medium">{S.auditLog.columns.entity}</th>
              <th className="text-left px-4 py-2 font-medium">{S.auditLog.columns.event}</th>
              <th className="text-left px-4 py-2 font-medium">{S.auditLog.columns.actor}</th>
              <th className="text-left px-4 py-2 font-medium">{S.auditLog.columns.hash}</th>
            </tr>
          </thead>
          <tbody>
            {entries && entries.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--c-text-secondary)]">No audit entries yet.</td></tr>
            )}
            {entries?.map((e) => (
              <tr key={e.event_id} className="border-b border-[var(--c-border)] hover:bg-[var(--c-bg)]">
                <td className="px-4 py-2 whitespace-nowrap">{formatTime(e.recorded_at)}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.entity_id}</td>
                <td className="px-4 py-2">{e.event_type}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded mr-1 ${
                    e.actor.type === 'ai' ? 'bg-[var(--c-primary)]/10 text-[var(--c-primary)]'
                      : e.actor.type === 'system' ? 'bg-[var(--c-border)] text-[var(--c-text-secondary)]'
                      : 'bg-[var(--c-green-bg)] text-[var(--c-green)]'
                  }`}>{e.actor.type}</span>
                  {e.actor.role && <span className="text-xs text-[var(--c-text-secondary)]">{e.actor.role}</span>}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-[var(--c-text-secondary)]">{e.hash.slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
