import { useCallback, useEffect, useState } from 'react';
import {
  approveRisk, escalateRisk, getAnalysis, getAuditLog, getErrorMessage,
  getRole, patchRisk, rejectRisk, resolveRisk,
} from '../api';
import { S } from '../strings';
import type {
  AuditEntry, Category, EscalationTarget, Risk, RiskPatch, Strategy,
} from '../types';
import EvidenceHighlight from './EvidenceHighlight';
import { LEVEL_COLORS, STATUS_COLORS } from './RiskRow';

const CATEGORIES: Category[] = ['financial', 'operational', 'it', 'infosec', 'reputational'];
const STRATEGIES: Strategy[] = ['avoid', 'mitigate', 'transfer', 'accept'];
const FINAL_STATUSES = ['rejected', 'resolved'];

const inputClass = 'w-full bg-[var(--c-input-bg)] border border-[var(--c-input-border)] text-[var(--c-text)] text-sm rounded-lg px-3 py-2 focus:border-[var(--c-primary-border)] focus:ring-1 focus:ring-[var(--c-primary-border)] transition-colors placeholder:text-[var(--c-text-muted)]';
const labelClass = 'text-[10px] tracking-widest uppercase font-semibold text-[var(--c-text-muted)] block mb-1';

interface Props {
  risk: Risk;
  onClose: () => void;
  onUpdate: (r: Risk) => void;
}

export default function RiskDrawer({ risk, onClose, onUpdate }: Props) {
  const [analysisText, setAnalysisText] = useState('');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [actionMode, setActionMode] = useState<'' | 'edit' | 'reject' | 'escalate'>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const [editForm, setEditForm] = useState<RiskPatch>({});
  const [rejectReason, setRejectReason] = useState('');
  const [escalateTo, setEscalateTo] = useState<EscalationTarget>('ciso');
  const [escalateReason, setEscalateReason] = useState('');
  const [actionComment] = useState('');

  const isAuditor = getRole() === 'auditor';
  const isFinal = FINAL_STATUSES.includes(risk.status);

  useEffect(() => {
    getAnalysis(risk.analysis_id)
      .then((a) => setAnalysisText(a.text))
      .catch(() => {});
    getAuditLog(risk.risk_id, 50)
      .then(setAuditEntries)
      .catch(() => {});
  }, [risk.analysis_id, risk.risk_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const doAction = useCallback(async (fn: () => Promise<Risk>) => {
    setBusy(true);
    setError('');
    try {
      const updated = await fn();
      onUpdate(updated);
      setActionMode('');
      showToast('Done');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [onUpdate]);

  const handleApprove = () => doAction(() => approveRisk(risk.risk_id, actionComment || undefined));
  const handleResolve = () => doAction(() => resolveRisk(risk.risk_id, actionComment || undefined));
  const handleReject = () => {
    if (!rejectReason.trim()) return;
    doAction(() => rejectRisk(risk.risk_id, rejectReason));
  };
  const handleEscalate = () => {
    if (!escalateReason.trim()) return;
    doAction(() => escalateRisk(risk.risk_id, escalateTo, escalateReason));
  };
  const handleEdit = () => {
    const patch: RiskPatch = {};
    if (editForm.probability !== undefined) patch.probability = editForm.probability;
    if (editForm.impact !== undefined) patch.impact = editForm.impact;
    if (editForm.statement !== undefined && editForm.statement !== risk.statement) patch.statement = editForm.statement;
    if (editForm.category !== undefined && editForm.category !== risk.category) patch.category = editForm.category;
    if (editForm.strategy !== undefined && editForm.strategy !== risk.strategy) patch.strategy = editForm.strategy;
    if (editForm.owner_role !== undefined) patch.owner_role = editForm.owner_role;
    if (editForm.trigger !== undefined) patch.trigger = editForm.trigger;
    if (editForm.actions !== undefined) patch.actions = editForm.actions;
    if (editForm.source !== undefined) patch.source = editForm.source;
    if (editForm.comment) patch.comment = editForm.comment;
    if (Object.keys(patch).length === 0) { setActionMode(''); return; }
    doAction(() => patchRisk(risk.risk_id, patch));
  };

  const openEdit = () => {
    setEditForm({
      probability: risk.probability,
      impact: risk.impact,
      statement: risk.statement,
      category: risk.category,
      strategy: risk.strategy,
      owner_role: risk.owner_role,
      trigger: risk.trigger,
      actions: [...risk.actions],
      source: risk.source ?? '',
      comment: '',
    });
    setActionMode('edit');
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const btnBase = 'px-4 py-2 rounded-lg text-xs tracking-wider uppercase font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[var(--c-surface)] border-l border-[var(--c-border)] z-50 overflow-y-auto flex flex-col animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--c-surface)]/95 backdrop-blur-sm border-b border-[var(--c-border)] px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${LEVEL_COLORS[risk.level]}`}>{risk.score}</span>
            <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded font-medium ${STATUS_COLORS[risk.status]}`}>{risk.status}</span>
            <span className="text-[10px] tracking-wider uppercase text-[var(--c-text-muted)]">{Math.round(risk.confidence * 100)}%</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--c-text-muted)] hover:text-[var(--c-primary)] hover:bg-[var(--c-primary-dim)] transition-all" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--c-border)]">
          {(['details', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-xs tracking-widest uppercase font-semibold border-b-2 transition-colors ${tab === t ? 'border-[var(--c-primary)] text-[var(--c-primary)]' : 'border-transparent text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)]'}`}>
              {t === 'details' ? S.risk.evidence : S.risk.history}
            </button>
          ))}
        </div>

        <div className="flex-1 p-5 space-y-5">
          {toast && <div className="bg-[var(--c-green-bg)] text-[var(--c-green)] text-sm px-4 py-3 rounded-lg border border-[var(--c-green)]/20 animate-fade-in">{toast}</div>}
          {error && <div className="bg-[var(--c-red-bg)] text-[var(--c-red)] text-sm px-4 py-3 rounded-lg border border-[var(--c-red)]/20 animate-fade-in">{error}</div>}

          {tab === 'details' ? (
            <>
              <div>
                <p className="text-sm font-medium text-[var(--c-text)] break-words leading-relaxed">{risk.statement}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[risk.category, risk.classification, risk.source].filter(Boolean).map((tag) => (
                    <span key={tag} className="text-[10px] tracking-wider uppercase bg-[var(--c-bg-subtle)] text-[var(--c-text-muted)] px-2.5 py-1 rounded border border-[var(--c-border)]">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 text-xs text-[var(--c-text-muted)] bg-[var(--c-bg-subtle)] rounded-lg p-3 border border-[var(--c-border)]">
                <span>P: <span className="text-[var(--c-text)] font-semibold">{risk.probability}</span></span>
                <span>I: <span className="text-[var(--c-text)] font-semibold">{risk.impact}</span></span>
                <span>Score: <span className="text-[var(--c-primary)] font-semibold">{risk.probability} × {risk.impact} = {risk.score}</span></span>
              </div>

              <div>
                <h4 className={labelClass}>{S.risk.rationale}</h4>
                <p className="text-sm text-[var(--c-text-secondary)] break-words leading-relaxed">{risk.rationale}</p>
              </div>

              {analysisText && (
                <div>
                  <h4 className={labelClass}>{S.risk.evidence}</h4>
                  <div className="bg-[var(--c-bg-subtle)] rounded-lg p-4 max-h-64 overflow-y-auto border border-[var(--c-border)]">
                    <EvidenceHighlight text={analysisText} evidence={risk.evidence} />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {risk.evidence.map((e, i) => (
                      <span key={i} className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded font-medium border ${e.verified ? 'bg-[var(--c-green-bg)] text-[var(--c-green)] border-[var(--c-green)]/20' : 'bg-[var(--c-yellow-bg)] text-[var(--c-yellow)] border-[var(--c-yellow)]/20'}`}>
                        {e.verified ? S.risk.verified : S.risk.unverified}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className={labelClass}>{S.risk.strategy}</h4>
                  <p className="text-sm text-[var(--c-text)] capitalize">{risk.strategy}</p>
                </div>
                <div>
                  <h4 className={labelClass}>{S.risk.owner}</h4>
                  <p className="text-sm text-[var(--c-text)]">{risk.owner_role || '—'}</p>
                </div>
              </div>
              <div>
                <h4 className={labelClass}>{S.risk.trigger}</h4>
                <p className="text-sm text-[var(--c-text-secondary)]">{risk.trigger || S.risk.noTrigger}</p>
              </div>
              <div>
                <h4 className={labelClass}>{S.risk.actions}</h4>
                {risk.actions.length > 0 ? (
                  <ul className="text-sm text-[var(--c-text-secondary)] list-none space-y-1.5">
                    {risk.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 break-words">
                        <span className="text-[var(--c-primary)] mt-1">›</span> {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--c-text-muted)]">{S.risk.noActions}</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {auditEntries.length === 0 && <p className="text-sm text-[var(--c-text-muted)]">No history yet.</p>}
              {auditEntries.map((entry) => (
                <div key={entry.event_id} className="bg-[var(--c-bg-subtle)] rounded-lg p-3 text-sm border border-[var(--c-border)] hover:border-[var(--c-primary-border)] transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-[var(--c-text)]">{entry.event_type}</span>
                    <span className="text-[10px] tracking-wider text-[var(--c-text-muted)]">{formatTime(entry.recorded_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] tracking-wider uppercase text-[var(--c-text-muted)]">
                    <span className={`px-1.5 py-0.5 rounded font-medium border ${entry.actor.type === 'ai' ? 'bg-[var(--c-primary-dim)] text-[var(--c-primary)] border-[var(--c-primary-border)]' : entry.actor.type === 'system' ? 'bg-[var(--c-bg)] text-[var(--c-text-muted)] border-[var(--c-border)]' : 'bg-[var(--c-green-bg)] text-[var(--c-green)] border-[var(--c-green)]/20'}`}>
                      {entry.actor.type}
                    </span>
                    {entry.actor.role && <span>{entry.actor.role}</span>}
                    <span className="font-mono text-[9px] text-[var(--c-text-muted)]">{entry.hash.slice(0, 12)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isAuditor && !isFinal && (
          <div className="sticky bottom-0 bg-[var(--c-surface)]/95 backdrop-blur-sm border-t border-[var(--c-border)] p-4">
            {actionMode === '' && (
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={handleApprove} className={`${btnBase} bg-[var(--c-green-bg)] text-[var(--c-green)] border border-[var(--c-green)]/20 hover:bg-[var(--c-green)]/20`}>{S.risk.approve}</button>
                <button disabled={busy} onClick={openEdit} className={`${btnBase} bg-[var(--c-primary-dim)] text-[var(--c-primary)] border border-[var(--c-primary-border)] hover:bg-[var(--c-primary)]/20`}>{S.risk.edit}</button>
                <button disabled={busy} onClick={() => setActionMode('escalate')} className={`${btnBase} bg-[var(--c-orange-bg)] text-[var(--c-orange)] border border-[var(--c-orange)]/20 hover:bg-[var(--c-orange)]/20`}>{S.risk.escalate}</button>
                <button disabled={busy} onClick={() => setActionMode('reject')} className={`${btnBase} bg-[var(--c-red-bg)] text-[var(--c-red)] border border-[var(--c-red)]/20 hover:bg-[var(--c-red)]/20`}>{S.risk.reject}</button>
                {risk.status === 'approved' && (
                  <button disabled={busy} onClick={handleResolve} className={`${btnBase} bg-[var(--c-bg-subtle)] text-[var(--c-text-secondary)] border border-[var(--c-border)] hover:border-[var(--c-primary-border)]`}>{S.risk.resolve}</button>
                )}
              </div>
            )}

            {actionMode === 'reject' && (
              <div className="space-y-3 animate-fade-in">
                <label className={labelClass}>{S.risk.rejectReasonLabel}</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} className={inputClass} />
                <div className="flex gap-2">
                  <button disabled={busy || !rejectReason.trim()} onClick={handleReject} className={`${btnBase} bg-[var(--c-red-bg)] text-[var(--c-red)] border border-[var(--c-red)]/20`}>{S.risk.reject}</button>
                  <button onClick={() => setActionMode('')} className={`${btnBase} border border-[var(--c-border)] text-[var(--c-text-secondary)]`}>{S.risk.cancel}</button>
                </div>
              </div>
            )}

            {actionMode === 'escalate' && (
              <div className="space-y-3 animate-fade-in">
                <label className={labelClass}>{S.risk.escalateToLabel}</label>
                <select value={escalateTo} onChange={(e) => setEscalateTo(e.target.value as EscalationTarget)} className={inputClass}>
                  <option value="ciso">CISO</option>
                  <option value="pmo">PMO</option>
                </select>
                <label className={labelClass}>{S.risk.escalateReasonLabel}</label>
                <textarea value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} rows={2} className={inputClass} />
                <div className="flex gap-2">
                  <button disabled={busy || !escalateReason.trim()} onClick={handleEscalate} className={`${btnBase} bg-[var(--c-orange-bg)] text-[var(--c-orange)] border border-[var(--c-orange)]/20`}>{S.risk.escalate}</button>
                  <button onClick={() => setActionMode('')} className={`${btnBase} border border-[var(--c-border)] text-[var(--c-text-secondary)]`}>{S.risk.cancel}</button>
                </div>
              </div>
            )}

            {actionMode === 'edit' && (
              <div className="space-y-3 max-h-80 overflow-y-auto animate-fade-in pr-1">
                <div>
                  <label className={labelClass}>Statement</label>
                  <textarea value={editForm.statement ?? ''} onChange={(e) => setEditForm({ ...editForm, statement: e.target.value })} rows={2} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Probability (1-5)</label>
                    <input type="number" min={1} max={5} value={editForm.probability ?? ''} onChange={(e) => setEditForm({ ...editForm, probability: Number(e.target.value) })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Impact (1-5)</label>
                    <input type="number" min={1} max={5} value={editForm.impact ?? ''} onChange={(e) => setEditForm({ ...editForm, impact: Number(e.target.value) })} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Category</label>
                    <select value={editForm.category ?? ''} onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Category })} className={inputClass}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Strategy</label>
                    <select value={editForm.strategy ?? ''} onChange={(e) => setEditForm({ ...editForm, strategy: e.target.value as Strategy })} className={inputClass}>
                      {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Owner Role</label>
                  <input value={editForm.owner_role ?? ''} onChange={(e) => setEditForm({ ...editForm, owner_role: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Trigger</label>
                  <input value={editForm.trigger ?? ''} onChange={(e) => setEditForm({ ...editForm, trigger: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Source</label>
                  <input value={editForm.source ?? ''} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{S.risk.commentLabel}</label>
                  <input value={editForm.comment ?? ''} onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })} className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <button disabled={busy} onClick={handleEdit} className={`${btnBase} bg-[var(--c-primary-dim)] text-[var(--c-primary)] border border-[var(--c-primary-border)] hover:bg-[var(--c-primary)]/20`}>{S.risk.save}</button>
                  <button onClick={() => setActionMode('')} className={`${btnBase} border border-[var(--c-border)] text-[var(--c-text-secondary)]`}>{S.risk.cancel}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
