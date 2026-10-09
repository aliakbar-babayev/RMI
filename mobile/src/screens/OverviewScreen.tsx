import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Donut } from '../components/Donut';
import { HeatMap } from '../components/HeatMap';
import { RiskCard } from '../components/RiskCard';
import { Card, ErrorText, h } from '../ui';
import { colors, font, levelColor, space } from '../theme';
import { CATEGORY_LABEL, STRATEGY_LABEL } from '../labels';
import { Category, Heatmap, Level, Strategy } from '../types';
import { useNav } from '../nav';
import { useRisks } from '../useRisks';
import { Header } from './Header';

const DECIDED = ['approved', 'edited', 'escalated', 'resolved'];
const STRATEGIES: Strategy[] = ['accept', 'avoid', 'mitigate', 'transfer'];
const LEVELS: Level[] = ['critical', 'high', 'medium', 'low'];
const GREY = '#5b5b66';

export function OverviewScreen({ refreshKey }: { refreshKey: number }) {
  const nav = useNav();
  const { risks, loading, error, reload } = useRisks(refreshKey);
  const [heat, setHeat] = useState<Heatmap | null>(null);
  const [picked, setPicked] = useState<Strategy | null>(null);
  const [cell, setCell] = useState<{ key: string; ids: string[] } | null>(null);

  useEffect(() => {
    setCell(null);
    api.heatmap('open').then(setHeat).catch(() => setHeat(null));
  }, [refreshKey]);

  const byStrategy = useMemo(() => STRATEGIES.map((st) => {
    const list = risks.filter((r) => r.strategy === st);
    const approved = list.filter((r) => DECIDED.includes(r.status)).length;
    return { st, approved, notApproved: list.length - approved, total: list.length };
  }), [risks]);
  const maxBar = Math.max(1, ...byStrategy.map((b) => b.total));

  const tasks = risks.filter((r) => DECIDED.includes(r.status)).flatMap((r) => r.actions.map(() => r.status === 'resolved'));
  const tasksDone = tasks.filter(Boolean).length;

  const decision = [
    { label: 'Approved', value: risks.filter((r) => r.status === 'approved' || r.status === 'edited').length, color: colors.ok },
    { label: 'Pending', value: risks.filter((r) => r.status === 'pending').length, color: GREY },
    { label: 'Escalated', value: risks.filter((r) => r.status === 'escalated').length, color: colors.accent },
    { label: 'Resolved', value: risks.filter((r) => r.status === 'resolved').length, color: '#4f9e7a' },
  ];

  const categories = useMemo(() => (Object.keys(CATEGORY_LABEL) as Category[])
    .map((c) => {
      const list = risks.filter((r) => r.category === c);
      return { c, total: list.length, levels: LEVELS.map((l) => ({ l, n: list.filter((r) => r.level === l).length })) };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6), [risks]);
  const maxCat = Math.max(1, ...categories.map((x) => x.total));
  const sel = byStrategy.find((b) => b.st === picked);

  return (
    <ScrollView contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}>
      <Header title="Overview" count={risks.length} />
      <ErrorText message={error} />

      <Text style={h.section}>Risk treatment</Text>
      <Text style={[h.muted, s.sub]}>Make sure every risk is assessed and approved, then complete its tasks.</Text>

      <Card>
        <Text style={s.cardTitle}>Risks by treatment type</Text>
        <View style={s.chart}>
          {byStrategy.map((b) => (
            <Pressable key={b.st} style={s.barCol} onPress={() => setPicked(picked === b.st ? null : b.st)} accessibilityRole="button"
              accessibilityLabel={`${STRATEGY_LABEL[b.st]}: ${b.approved} approved, ${b.notApproved} not approved`}>
              <Text style={s.barNum}>{b.total}</Text>
              <View style={[s.barTrack, picked === b.st && { borderColor: colors.accent }]}>
                <View style={{ flex: maxBar - b.total }} />
                <View style={{ flex: b.notApproved, backgroundColor: GREY, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                <View style={{ flex: b.approved, backgroundColor: colors.ok, borderTopLeftRadius: b.notApproved ? 0 : 6, borderTopRightRadius: b.notApproved ? 0 : 6 }} />
              </View>
              <Text style={[s.barLabel, picked === b.st && { color: colors.accent }]}>{STRATEGY_LABEL[b.st]}</Text>
            </Pressable>
          ))}
        </View>
        {sel && (
          <View style={s.tip}>
            <Text style={s.tipTitle}>Risks to “{STRATEGY_LABEL[sel.st]}”</Text>
            <View style={s.tipRow}><View style={[s.sw, { backgroundColor: colors.ok }]} /><Text style={s.tipText}>Approved</Text><Text style={s.tipVal}>{sel.approved}</Text></View>
            <View style={s.tipRow}><View style={[s.sw, { backgroundColor: GREY }]} /><Text style={s.tipText}>Not approved</Text><Text style={s.tipVal}>{sel.notApproved}</Text></View>
          </View>
        )}
        <View style={s.legend}>
          <View style={s.tipRow}><View style={[s.sw, { backgroundColor: colors.ok }]} /><Text style={s.legendText}>Approved</Text></View>
          <View style={s.tipRow}><View style={[s.sw, { backgroundColor: GREY }]} /><Text style={s.legendText}>Not approved</Text></View>
        </View>
      </Card>

      <Card style={s.gapCard}>
        <Text style={s.cardTitle}>Task status</Text>
        <Donut total={tasks.length} caption="Total tasks"
          parts={[{ label: 'Completed', value: tasksDone, color: colors.ok }, { label: 'Open', value: tasks.length - tasksDone, color: GREY }]} />
        <Text style={s.link} onPress={() => nav.goTab('actions')}>Open action tracker →</Text>
      </Card>

      <Card style={s.gapCard}>
        <Text style={s.cardTitle}>Decision status</Text>
        <Donut total={risks.length} caption="Total risks" parts={decision} />
        <Text style={s.link} onPress={() => nav.goTab('register')}>Open risk register →</Text>
      </Card>

      <Text style={[h.section, s.gap]}>Risk distribution</Text>
      <Text style={[h.muted, s.sub]}>Open risks by likelihood and consequence, and the categories with the most risks.</Text>

      <Card>
        <Text style={s.cardTitle}>Current risk</Text>
        {heat ? (
          <HeatMap
            cells={heat.cells}
            selected={cell?.key}
            onCell={(c) => {
              // One risk: open it. Several: show all of them below so the user can pick.
              if (c.risk_ids.length === 1) { setCell(null); nav.openRisk(c.risk_ids[0]); return; }
              const key = `${c.p}-${c.i}`;
              setCell(cell?.key === key ? null : { key, ids: c.risk_ids });
            }}
          />
        ) : <Text style={h.muted}>No data yet.</Text>}
        {cell && (
          <View style={s.cellList}>
            <View style={s.cellHead}>
              <Text style={s.cellTitle}>{cell.ids.length} risks in this cell</Text>
              <Text style={s.link} onPress={() => setCell(null)}>Close</Text>
            </View>
            {cell.ids.map((id) => {
              const r = risks.find((x) => x.risk_id === id);
              return r
                ? <RiskCard key={id} risk={r} onPress={() => nav.openRisk(id)} />
                : <Text key={id} style={s.link} onPress={() => nav.openRisk(id)}>{id}</Text>;
            })}
          </View>
        )}
      </Card>

      <Card style={s.gapCard}>
        <Text style={s.cardTitle}>Top risk categories</Text>
        {categories.length === 0 && <Text style={h.muted}>No risks yet.</Text>}
        <View style={{ gap: space.md }}>
          {categories.map((x) => (
            <View key={x.c} style={s.catRow}>
              <Text style={s.catLabel} numberOfLines={2}>{CATEGORY_LABEL[x.c]}</Text>
              <View style={s.catTrack}>
                <View style={{ flexDirection: 'row', flex: x.total, borderRadius: 4, overflow: 'hidden' }}>
                  {x.levels.filter((v) => v.n > 0).map((v) => (
                    <View key={v.l} style={{ flex: v.n, backgroundColor: levelColor[v.l], height: 22 }} />
                  ))}
                </View>
                <View style={{ flex: maxCat - x.total }} />
              </View>
              <Text style={s.catNum}>{x.total}</Text>
            </View>
          ))}
        </View>
        <View style={[s.legend, { marginTop: space.md }]}>
          {LEVELS.map((l) => (
            <View key={l} style={s.tipRow}>
              <View style={[s.sw, { backgroundColor: levelColor[l] }]} />
              <Text style={s.legendText}>{l === 'critical' ? 'Extreme' : l[0].toUpperCase() + l.slice(1)}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: 130 },
  sub: { marginTop: -6, marginBottom: space.md },
  gap: { marginTop: space.xl },
  gapCard: { marginTop: space.md },
  cardTitle: { fontFamily: font.semibold, color: colors.text, fontSize: 15, marginBottom: space.md },
  chart: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, height: 170 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barNum: { fontFamily: font.medium, color: colors.muted, fontSize: 11 },
  barTrack: { flex: 1, width: '70%', borderBottomWidth: 1, borderColor: colors.line, borderRadius: 6 },
  barLabel: { fontFamily: font.regular, color: colors.muted, fontSize: 11 },
  tip: { marginTop: space.md, backgroundColor: colors.raised, borderRadius: 10, padding: space.md, gap: 6, borderWidth: 1, borderColor: colors.line },
  tipTitle: { fontFamily: font.medium, color: colors.text, fontSize: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { flex: 1, fontFamily: font.regular, color: colors.text, fontSize: 12 },
  tipVal: { fontFamily: font.semibold, color: colors.text, fontSize: 12 },
  sw: { width: 9, height: 9, borderRadius: 2 },
  legend: { flexDirection: 'row', gap: space.lg, marginTop: space.md, flexWrap: 'wrap' },
  legendText: { fontFamily: font.regular, color: colors.muted, fontSize: 11 },
  link: { fontFamily: font.medium, color: colors.accent, fontSize: 13, marginTop: space.md },
  cellList: { marginTop: space.lg, gap: space.sm },
  cellHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cellTitle: { fontFamily: font.medium, color: colors.text, fontSize: 13 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  catLabel: { width: 86, fontFamily: font.regular, color: colors.muted, fontSize: 11, textAlign: 'right' },
  catTrack: { flex: 1, flexDirection: 'row' },
  catNum: { width: 22, fontFamily: font.semibold, color: colors.text, fontSize: 12 },
});
