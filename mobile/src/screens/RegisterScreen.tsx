import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, ChipRow, ErrorText, SearchBar, StatusChip, h } from '../ui';
import { colors, font, levelColor, space } from '../theme';
import { CATEGORY_LABEL, STATUS_LABEL, STRATEGY_LABEL, treatmentStatus } from '../labels';
import { Category, Level, Risk, Status, Strategy } from '../types';
import { useNav } from '../nav';
import { useRisks } from '../useRisks';
import { Header } from './Header';

const statusColor: Partial<Record<Status, string>> = { approved: colors.ok, escalated: colors.warn, resolved: colors.ok, edited: colors.accent };
const treatColor = (t: string) => (t === 'OK' ? colors.ok : t === 'In progress' ? colors.accent : undefined);

function RegisterRow({ r, onPress }: { r: Risk; onPress: () => void }) {
  const t = treatmentStatus(r.status);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }} accessibilityRole="button">
      <View style={s.row}>
        <View style={s.rowTop}>
          <Text style={s.id}>{r.risk_id}</Text>
          <Text style={s.scenario} numberOfLines={2}>{r.statement}</Text>
          <View style={[s.score, { backgroundColor: levelColor[r.level] }]}><Text style={s.scoreText}>{r.score}</Text></View>
        </View>
        <View style={s.meta}>
          <View style={s.owner}>
            <Ionicons name="person-circle-outline" size={15} color={colors.muted} />
            <Text style={s.metaText}>{r.owner_role || 'Unassigned'}</Text>
          </View>
          <Text style={s.metaText}>· {STRATEGY_LABEL[r.strategy]}</Text>
          <View style={{ flex: 1 }} />
          <StatusChip label={t} color={treatColor(t)} />
          <StatusChip label={STATUS_LABEL[r.status]} color={statusColor[r.status]} />
        </View>
      </View>
    </Pressable>
  );
}

export function RegisterScreen({ refreshKey }: { refreshKey: number }) {
  const nav = useNav();
  const { risks, loading, error, reload } = useRisks(refreshKey);
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [level, setLevel] = useState<Level | null>(null);

  const active = [status, category, strategy, level].filter(Boolean).length;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return risks
      .filter((r) => (!status || r.status === status) && (!category || r.category === category) && (!strategy || r.strategy === strategy) && (!level || r.level === level))
      .filter((r) => !needle || `${r.risk_id} ${r.statement} ${r.owner_role} ${r.source ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => b.score - a.score);
  }, [risks, q, status, category, strategy, level]);

  return (
    <FlatList
      data={shown}
      keyExtractor={(r) => r.risk_id}
      contentContainerStyle={s.pad}
      keyboardShouldPersistTaps="handled"
      ItemSeparatorComponent={() => <View style={s.sep} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.md }}>
          <Header title="Risk scenarios" count={risks.length} />
          <View style={s.searchRow}>
            <View style={{ flex: 1 }}><SearchBar value={q} onChange={setQ} placeholder="Search scenarios, owners, IDs" /></View>
            <Pressable onPress={() => setShowFilters(!showFilters)} style={[s.filterBtn, (showFilters || active > 0) && s.filterOn]} accessibilityRole="button" accessibilityLabel="Filters">
              <Ionicons name="options-outline" size={18} color={showFilters || active > 0 ? '#fff' : colors.text} />
              {active > 0 && <Text style={s.filterCount}>{active}</Text>}
            </Pressable>
          </View>
          {showFilters && (
            <Card style={{ gap: space.md, padding: space.md }}>
              <ChipRow label="Status" value={status} onChange={setStatus}
                options={(['pending', 'approved', 'escalated', 'resolved'] as Status[]).map((k) => ({ key: k, label: STATUS_LABEL[k] }))} />
              <ChipRow label="Inherent risk" value={level} onChange={setLevel}
                options={[{ key: 'critical', label: 'Extreme' }, { key: 'high', label: 'High' }, { key: 'medium', label: 'Medium' }, { key: 'low', label: 'Low' }] as { key: Level; label: string }[]} />
              <ChipRow label="Treatment plan" value={strategy} onChange={setStrategy}
                options={(Object.keys(STRATEGY_LABEL) as Strategy[]).map((k) => ({ key: k, label: STRATEGY_LABEL[k] }))} />
              <ChipRow label="Category" value={category} onChange={setCategory}
                options={(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => ({ key: k, label: CATEGORY_LABEL[k] }))} />
              {active > 0 && (
                <Text style={s.clear} onPress={() => { setStatus(null); setCategory(null); setStrategy(null); setLevel(null); }}>Clear all filters</Text>
              )}
            </Card>
          )}
          <ErrorText message={error} />
          <Text style={h.label}>{shown.length} of {risks.length} scenarios · sorted by inherent risk</Text>
        </View>
      }
      ListEmptyComponent={!loading && !error ? <Card><Text style={h.muted}>No scenarios match. Add risks from the Add tab.</Text></Card> : null}
      renderItem={({ item }) => <RegisterRow r={item} onPress={() => nav.openRisk(item.risk_id)} />}
    />
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: 130 },
  sep: { height: space.sm },
  searchRow: { flexDirection: 'row', gap: space.sm },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, minWidth: 44, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line },
  filterOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterCount: { fontFamily: font.semibold, color: '#fff', fontSize: 12 },
  clear: { fontFamily: font.medium, color: colors.accent, fontSize: 13 },
  row: { backgroundColor: colors.card, borderRadius: 14, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  id: { fontFamily: font.medium, color: colors.muted, fontSize: 12, width: 42, marginTop: 2 },
  scenario: { flex: 1, fontFamily: font.regular, color: colors.text, fontSize: 14, lineHeight: 20 },
  score: { minWidth: 30, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  scoreText: { fontFamily: font.semibold, color: '#fff', fontSize: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 50 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
});
