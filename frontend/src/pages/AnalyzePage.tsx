import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAnalysis, getErrorMessage, getSamples } from '../api';
import RiskDrawer from '../components/RiskDrawer';
import RiskRow from '../components/RiskRow';
import { S } from '../strings';
import type { Risk, Sample } from '../types';

export default function AnalyzePage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  useEffect(() => {
    getSamples().then(setSamples).catch(() => {});
  }, []);

  const handleSample = (id: string) => {
    const sample = samples.find((s) => s.id === id);
    if (sample) {
      setText(sample.text);
      setSource(sample.source);
    }
  };

  const handleAnalyze = async () => {
    if (!text.trim()) { setError(S.errors.empty_input); return; }
    setLoading(true);
    setError('');
    setRisks([]);
    try {
      const result = await createAnalysis(text, undefined, source || undefined);
      setRisks(result.risks);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRiskUpdate = (updated: Risk) => {
    setRisks((prev) => prev.map((r) => (r.risk_id === updated.risk_id ? updated : r)));
    setSelectedRisk(updated);
  };

  const inputClass = 'w-full bg-[var(--c-input-bg)] border border-[var(--c-input-border)] text-[var(--c-text)] text-sm rounded-lg px-4 py-3 focus:border-[var(--c-primary-border)] focus:ring-1 focus:ring-[var(--c-primary-border)] transition-colors placeholder:text-[var(--c-text-muted)]';
  const labelClass = 'text-[10px] tracking-widest uppercase font-semibold text-[var(--c-text-muted)] block mb-2';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-[var(--c-primary-dim)] border border-[var(--c-primary-border)] flex items-center justify-center">
          <svg className="w-4 h-4 text-[var(--c-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold tracking-wide">{S.analyze.title}</h1>
      </div>

      {samples.length > 0 && (
        <div>
          <label className={labelClass}>{S.analyze.sampleLabel}</label>
          <select
            onChange={(e) => handleSample(e.target.value)}
            defaultValue=""
            className={inputClass + ' cursor-pointer'}
          >
            <option value="" disabled>{S.analyze.sampleDefault}</option>
            {samples.map((s) => (
              <option key={s.id} value={s.id}>[{s.language.toUpperCase()}] {s.title}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={S.analyze.placeholder}
          rows={10}
          className={inputClass + ' resize-y font-mono text-xs leading-relaxed'}
        />
      </div>

      <div>
        <label className={labelClass}>{S.analyze.sourceLabel}</label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={S.analyze.sourcePlaceholder}
          className={inputClass}
        />
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || !text.trim()}
        className="w-full sm:w-auto px-8 py-3 bg-[var(--c-surface)] border border-[var(--c-primary-border)] text-[var(--c-primary)] rounded-lg font-semibold text-xs tracking-widest uppercase hover:bg-[var(--c-primary-dim)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-[var(--c-primary)] border-t-transparent rounded-full animate-spin" />
            {S.analyze.loading}
          </>
        ) : (
          <>
            {S.analyze.button}
            <span>→</span>
          </>
        )}
      </button>

      {error && (
        <div className="bg-[var(--c-red-bg)] text-[var(--c-red)] text-sm px-4 py-3 rounded-lg border border-[var(--c-red)]/20 animate-fade-in">{error}</div>
      )}

      {risks.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--c-primary)]">{S.analyze.risksFound(risks.length)}</h2>
            <Link to="/dashboard" className="text-xs tracking-wider uppercase text-[var(--c-primary)] hover:text-[var(--c-primary-hover)] transition-colors flex items-center gap-1">
              {S.analyze.successLink} <span>→</span>
            </Link>
          </div>
          {risks.map((r) => (
            <RiskRow key={r.risk_id} risk={r} onClick={() => setSelectedRisk(r)} />
          ))}
        </div>
      )}

      {selectedRisk && (
        <RiskDrawer
          risk={selectedRisk}
          onClose={() => setSelectedRisk(null)}
          onUpdate={handleRiskUpdate}
        />
      )}
    </div>
  );
}
