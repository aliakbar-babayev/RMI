import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { HeatMap } from '../components/HeatMap';
import { RiskCard } from '../components/RiskCard';
import { Button, Card, ErrorText, LevelBox, Pill, Tile, h } from '../ui';
import { colors, font, space } from '../theme';
import { Heatmap, Insights, Kpis, Level, Risk } from '../types';
import { Header } from './Header';

const LEVELS: Level[] = ['critical', 'high', 'medium', 'low'];
const levelOf = (score: number): Level => (score >= 16 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low');

export function DashboardScreen({ refreshKey, onOpen, onAdd }: { refreshKey: number; onOpen: (id: string) => void; onAdd: () => void }) {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [heat, setHeat] = useState<Heatmap | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [ins, setIns] = useState<Insights | null>(null);
  const [mode, setMode] = useState<'all' | 'open'>('all');
  const [level, setLevel] = useState<Level | null>(null);
  const [cell, setCell] = useState<{ key: string; ids: string[] } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [k, hm, all] = await Promise.all([api.kpis(), api.heatmap(mode), api.risks()]);
      setKpis(k); setHeat(hm); setRisks(all.filter((r) => r.status !== 'rejected'));
      api.insights().then(setIns).catch(() => setIns(null)); // optional: the model may be slow or down
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Level counts come from the heat map cells, i.e. from database queries.
  const counts = useMemo(() => {
    const c: Record<Level, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    heat?.cells.forEach((x) => { c[levelOf(x.p * x.i)] += mode === 'open' ? x.open : x.total; });
    return c;
  }, [heat, mode]);

  const shown = risks.filter((r) =>
    (mode === 'all' || !['resolved'].includes(r.status)) &&
    (!level || r.level === level) &&
    (!cell || cell.ids.includes(r.risk_id)));

  return (
    <ScrollView
      contentContainerStyle={s.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <Header title="Risk Bucket" />
      <View style={s.toolbar}>
        <View style={s.pillRow}>
          <Pill label="All" active={mode === 'all'} onPress={() => { setMode('all'); setCell(null); }} />
          <Pill label="Open" active={mode === 'open'} onPress={() => { setMode('open'); setCell(null); }} />
        </View>
        <Button label="＋ Add risk" small onPress={onAdd} />
      </View>
      <ErrorText message={error} />

      <View style={s.levels}>
        {LEVELS.map((l) => (
          <LevelBox key={l} level={l} value={counts[l]} active={level === l} onPress={() => { setLevel(level === l ? null : l); setCell(null); }} />
        ))}
      </View>

      <Text style={[h.section, s.gap]}>Risk Matrix</Text>
      <Card>
        {heat
          ? <HeatMap cells={heat.cells} selected={cell?.key} onCell={(c) => { const key = `${c.p}-${c.i}`; setLevel(null); setCell(cell?.key === key ? null : { key, ids: c.risk_ids }); }} />
          : <Text style={h.muted}>No data yet.</Text>}
      </Card>

      <View style={[s.tileRow, { marginTop: space.md }]}>
        <Tile label="Needs review" value={kpis?.needs_review ?? '–'} dot={colors.warn} style={{ flex: 1 }} />
        <Tile label="Escalated" value={kpis?.escalated ?? '–'} dot={colors.accent} style={{ flex: 1 }} />
        <Tile label="Resolved" value={kpis?.resolved ?? '–'} dot={colors.ok} style={{ flex: 1 }} />
      </View>

      {!!ins?.insights.length && (
        <>
          <Text style={[h.section, s.gap]}>AI Insights</Text>
          <Card style={{ gap: space.sm, borderColor: colors.accent + '55' }}>
            <Text style={s.kicker}>✦ {ins.generated_by === 'ai' ? 'Written by the AI from database facts' : 'From database facts'}</Text>
            {ins.insights.map((i, n) => <Text key={n} style={h.body}>{i.text}</Text>)}
          </Card>
        </>
      )}

      <View style={[s.listHead, s.gap]}>
        <Text style={[h.section, { marginBottom: 0 }]}>
          {cell ? 'Risks in cell' : level ? `${level === 'critical' ? 'Extreme' : level[0].toUpperCase() + level.slice(1)} risks` : 'All Risks'} ({shown.length})
        </Text>
        {(cell || level) && <Text style={s.clear} onPress={() => { setCell(null); setLevel(null); }}>Clear filter</Text>}
      </View>
      <View style={{ gap: space.sm }}>
        {shown.length === 0 && <Card><Text style={h.muted}>No risks here yet. Tap “Add risk” to analyze a document.</Text></Card>}
        {shown.map((r, n) => <RiskCard key={r.risk_id} risk={r} featured={n === 0 && !cell && !level} onPress={() => onOpen(r.risk_id)} />)}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, paddingTop: space.lg, paddingBottom: 120 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  pillRow: { flexDirection: 'row', gap: space.sm },
  levels: { flexDirection: 'row', gap: space.sm },
  tileRow: { flexDirection: 'row', gap: space.sm },
  gap: { marginTop: space.xl },
  kicker: { fontFamily: font.medium, color: colors.accent, fontSize: 12 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  clear: { fontFamily: font.medium, color: colors.accent, fontSize: 13 },
});
