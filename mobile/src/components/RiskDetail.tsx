import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError, getRole } from '../api';
import { Button, Card, ErrorText, IconButton, Pill, SeverityBadge, Stepper, Tag, h } from '../ui';
import { colors, font, levelColor, space } from '../theme';
import { AuditEntry, Risk } from '../types';

const CONTEXT = 90;
const num = (id: string) => id.replace(/^\D+0*/, '') || id;
const CATEGORY: Record<string, string> = {
  financial: 'Financial', operational: 'Operational', it: 'IT', infosec: 'Information Security', reputational: 'Reputational',
};
const STATUSES = ['pending', 'approved', 'escalated', 'resolved'] as const;

function Excerpt({ text, start, end }: { text: string; start: number; end: number }) {
  const from = Math.max(0, start - CONTEXT);
  return (
    <Text style={h.body}>
      {from > 0 ? '…' : ''}
      {text.slice(from, start)}
      <Text style={s.mark}>{text.slice(start, end)}</Text>
      {text.slice(end, end + CONTEXT)}
      {end + CONTEXT < text.length ? '…' : ''}
    </Text>
  );
}

type Tab = 'details' | 'evidence' | 'history';
type Mode = null | 'reject' | 'escalate';

export function RiskDetail({ riskId, onClose, onChanged }: { riskId: string | null; onClose: () => void; onChanged: () => void }) {
  const [risk, setRisk] = useState<Risk | null>(null);
  const [text, setText] = useState('');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('details');
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<'ciso' | 'pmo'>('ciso');

  const load = useCallback(async (id: string) => {
    setError('');
    try {
      const r = await api.risk(id);
      setRisk(r);
      const [a, log] = await Promise.all([api.analysis(r.analysis_id), api.audit(id)]);
      setText(a.text);
      setAudit(log);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the risk.');
    }
  }, []);

  useEffect(() => {
    setRisk(null); setMode(null); setReason(''); setError(''); setTab('details');
    if (riskId) load(riskId);
  }, [riskId, load]);

  async function run(action: () => Promise<Risk>) {
    setBusy(true); setError('');
    try {
      setRisk(await action());
      setMode(null); setReason('');
      onChanged();
      if (riskId) setAudit(await api.audit(riskId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  const final = !!risk && ['rejected', 'resolved'].includes(risk.status);
  const canAct = getRole() !== 'auditor' && !!risk && !final;

  return (
    <Modal visible={!!riskId} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <IconButton label="‹" onPress={onClose} />
          <Text style={s.headerTitle}>Risk Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
          {!risk && !error && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
          <ErrorText message={error} />
          {risk && (
            <>
              <Text style={h.title}>{CATEGORY[risk.category] ?? risk.category} risk <Text style={{ color: colors.muted }}>#{num(risk.risk_id)}</Text></Text>
              <Text style={[h.body, { marginTop: space.sm }]}>{risk.statement}</Text>
              <View style={s.chips}>
                <Tag label="AI generated" color={colors.accent} />
                <Tag label={risk.classification} />
                {risk.source && <Tag label={risk.source} />}
                {risk.needs_review && <Tag label="needs review" color={colors.warn} />}
              </View>

              <Card style={s.scoreCard}>
                <Stepper label="Likelihood" value={risk.probability} disabled={!canAct || busy}
                  onChange={(v) => run(() => api.edit(risk.risk_id, { probability: v }))} />
                <Stepper label="Consequence" value={risk.impact} disabled={!canAct || busy}
                  onChange={(v) => run(() => api.edit(risk.risk_id, { impact: v }))} />
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Text style={h.label}>Score</Text>
                  <Text style={[s.score, { color: levelColor[risk.level] }]}>{risk.score}</Text>
                </View>
              </Card>
              <View style={s.sevRow}>
                <Text style={h.label}>Severity</Text>
                <SeverityBadge level={risk.level} />
                <View style={{ flex: 1 }} />
                <Text style={h.label}>AI confidence {Math.round(risk.confidence * 100)}%</Text>
              </View>

              <View style={s.pills}>
                <Pill label="Details" active={tab === 'details'} onPress={() => setTab('details')} />
                <Pill label="Evidence" count={risk.evidence.length} active={tab === 'evidence'} onPress={() => setTab('evidence')} />
                <Pill label="History" count={audit.length} active={tab === 'history'} onPress={() => setTab('history')} />
              </View>

              {tab === 'details' && (
                <View style={{ gap: space.lg }}>
                  <View>
                    <View style={s.sectionRow}>
                      <Text style={[h.section, { marginBottom: 0 }]}>Action Notes</Text>
                      <Text style={s.suggested}>✦ Suggested by AI · {risk.strategy}</Text>
                    </View>
                    <Card style={{ gap: space.sm }}>
                      {risk.actions.length === 0 && <Text style={h.muted}>No actions proposed.</Text>}
                      {risk.actions.map((a, i) => <Text key={i} style={h.body}>{i + 1}. {a}</Text>)}
                    </Card>
                  </View>

                  <View style={s.fieldRow}>
                    <View style={s.field}><Text style={h.label}>Owner</Text><View style={s.box}><Text style={h.value}>{risk.owner_role || '—'}</Text></View></View>
                    <View style={s.field}><Text style={h.label}>Category</Text><View style={s.box}><Text style={h.value}>{CATEGORY[risk.category] ?? risk.category}</Text></View></View>
                  </View>
                  {!!risk.trigger && (
                    <View><Text style={h.label}>Trigger</Text><View style={s.box}><Text style={h.body}>{risk.trigger}</Text></View></View>
                  )}

                  <View>
                    <Text style={h.label}>Reasoning</Text>
                    <View style={s.box}><Text style={h.body}>{risk.rationale}</Text></View>
                  </View>

                  <View>
                    <Text style={h.label}>Status</Text>
                    <View style={s.segment}>
                      {STATUSES.map((st) => (
                        <View key={st} style={[s.segItem, risk.status === st && s.segOn]}>
                          <Text style={[s.segText, risk.status === st && { color: '#fff' }]}>{st}</Text>
                        </View>
                      ))}
                    </View>
                    {risk.status === 'rejected' && <Text style={[h.muted, { marginTop: 6 }]}>This risk was rejected.</Text>}
                  </View>
                </View>
              )}

              {tab === 'evidence' && (
                <View style={{ gap: space.md }}>
                  {risk.evidence.length === 0 && <Card><Text style={h.muted}>No verified quote for this risk.</Text></Card>}
                  {risk.evidence.map((ev, i) => (
                    <Card key={i} style={{ gap: space.sm }}>
                      <Text style={[s.verified, { color: ev.verified ? colors.ok : colors.danger }]}>
                        {ev.verified ? '✓ Verified quote from the document' : '✕ Unverified'}
                      </Text>
                      {ev.start != null && ev.end != null && text
                        ? <Excerpt text={text} start={ev.start} end={ev.end} />
                        : <Text style={h.body}>{ev.text}</Text>}
                    </Card>
                  ))}
                </View>
              )}

              {tab === 'history' && (
                <Card>
                  {audit.length === 0 && <Text style={h.muted}>No events yet.</Text>}
                  {audit.map((a, i) => (
                    <View key={a.event_id} style={s.event}>
                      <View style={s.rail}>
                        <View style={[s.railDot, { backgroundColor: a.actor.type === 'ai' ? colors.accent : colors.text }]} />
                        {i < audit.length - 1 && <View style={s.railLine} />}
                      </View>
                      <View style={{ flex: 1, paddingBottom: space.md }}>
                        <Text style={h.value}>{a.event_type}</Text>
                        <Text style={h.label}>
                          {new Date(a.recorded_at).toLocaleString()} · {a.actor.type === 'ai' ? 'AI' : a.actor.type}{a.actor.role ? ` (${a.actor.role})` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              {canAct && (
                <View style={s.actions}>
                  {mode === null ? (
                    <>
                      <Button label="Approve" disabled={busy || risk.status === 'approved'} onPress={() => run(() => api.approve(risk.risk_id))} />
                      <View style={s.twoCol}>
                        <View style={{ flex: 1 }}><Button label="Escalate" kind="dark" disabled={busy} onPress={() => setMode('escalate')} /></View>
                        <View style={{ flex: 1 }}><Button label="Reject" kind="ghost" disabled={busy} onPress={() => setMode('reject')} /></View>
                      </View>
                      <Button label="Mark resolved" kind="ghost" disabled={busy} onPress={() => run(() => api.resolve(risk.risk_id))} />
                    </>
                  ) : (
                    <>
                      {mode === 'escalate' && (
                        <View style={s.pillsTight}>
                          {(['ciso', 'pmo'] as const).map((t) => (
                            <Pill key={t} label={t.toUpperCase()} active={target === t} onPress={() => setTarget(t)} />
                          ))}
                        </View>
                      )}
                      <TextInput
                        style={s.input}
                        multiline
                        value={reason}
                        onChangeText={setReason}
                        placeholder={mode === 'reject' ? 'Reason for rejecting (required)' : 'Reason for escalating (required)'}
                        placeholderTextColor={colors.muted}
                      />
                      <Button
                        label={mode === 'reject' ? 'Confirm reject' : `Escalate to ${target.toUpperCase()}`}
                        kind={mode === 'reject' ? 'danger' : 'primary'}
                        disabled={busy || !reason.trim()}
                        onPress={() => run(() => (mode === 'reject' ? api.reject(risk.risk_id, reason.trim()) : api.escalate(risk.risk_id, target, reason.trim())))}
                      />
                      <Button label="Cancel" kind="ghost" onPress={() => { setMode(null); setReason(''); }} />
                    </>
                  )}
                </View>
              )}
              {getRole() === 'auditor' && <Text style={[h.muted, { marginTop: space.xl }]}>Auditors have read-only access.</Text>}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.md },
  headerTitle: { fontFamily: font.semibold, color: colors.text, fontSize: 16 },
  pad: { padding: space.lg, paddingTop: space.sm, paddingBottom: 80 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  scoreCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.lg, paddingHorizontal: space.md },
  score: { fontFamily: font.bold, fontSize: 30, lineHeight: 38 },
  sevRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  pills: { flexDirection: 'row', gap: space.sm, marginVertical: space.lg, flexWrap: 'wrap' },
  pillsTight: { flexDirection: 'row', gap: space.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  suggested: { fontFamily: font.medium, color: colors.accent, fontSize: 12, textTransform: 'capitalize' },
  fieldRow: { flexDirection: 'row', gap: space.sm },
  field: { flex: 1 },
  box: { backgroundColor: colors.raised, borderRadius: 12, padding: space.md, marginTop: 6, borderWidth: 1, borderColor: colors.line },
  segment: { flexDirection: 'row', backgroundColor: colors.raised, borderRadius: 12, padding: 4, marginTop: 6, borderWidth: 1, borderColor: colors.line },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segOn: { backgroundColor: colors.accent },
  segText: { fontFamily: font.medium, color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
  verified: { fontFamily: font.medium, fontSize: 12 },
  mark: { backgroundColor: '#f47b2033', color: '#ffb27a', fontFamily: font.medium },
  event: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 12 },
  railDot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  railLine: { flex: 1, width: 2, backgroundColor: colors.line, marginTop: 2 },
  actions: { marginTop: space.xl, gap: space.sm },
  twoCol: { flexDirection: 'row', gap: space.sm },
  input: { fontFamily: font.regular, backgroundColor: colors.input, color: colors.text, borderRadius: 12, padding: space.md, minHeight: 90, textAlignVertical: 'top', fontSize: 14, borderWidth: 1, borderColor: colors.line },
});
