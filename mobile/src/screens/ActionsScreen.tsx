import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, ErrorText, Pill, SearchBar, StatusChip, h } from '../ui';
import { colors, font, space } from '../theme';
import { useNav } from '../nav';
import { useRisks } from '../useRisks';
import { Header } from './Header';

interface Task { key: string; text: string; owner: string; done: boolean; riskId: string; strategy: string }

// Tasks are the response actions of risks a human has approved (or escalated / resolved).
// A task counts as completed when its risk is resolved; there are no per-task due dates in Phase 1.
const TRACKED = ['approved', 'edited', 'escalated', 'resolved'];

export function ActionsScreen({ refreshKey }: { refreshKey: number }) {
  const nav = useNav();
  const { risks, loading, error, reload } = useRisks(refreshKey);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');

  const tasks = useMemo<Task[]>(() =>
    risks.filter((r) => TRACKED.includes(r.status)).flatMap((r) =>
      r.actions.map((a, i) => ({
        key: `${r.risk_id}-${i}`, text: a, owner: r.owner_role || 'Unassigned', done: r.status === 'resolved', riskId: r.risk_id, strategy: r.strategy,
      }))), [risks]);

  const needle = q.trim().toLowerCase();
  const shown = tasks
    .filter((t) => filter === 'all' || (filter === 'done' ? t.done : !t.done))
    .filter((t) => !needle || `${t.text} ${t.owner} ${t.riskId}`.toLowerCase().includes(needle));
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <FlatList
      data={shown}
      keyExtractor={(t) => t.key}
      contentContainerStyle={s.pad}
      keyboardShouldPersistTaps="handled"
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.md }}>
          <Header title="Action tracker" count={tasks.length} />
          <Text style={h.muted}>Tasks from approved risk scenarios are tracked here.</Text>
          <SearchBar value={q} onChange={setQ} placeholder="Search by task, owner or risk" />
          <View style={s.pills}>
            <Pill label="All" count={tasks.length} active={filter === 'all'} onPress={() => setFilter('all')} />
            <Pill label="Open" count={tasks.length - doneCount} active={filter === 'open'} onPress={() => setFilter('open')} />
            <Pill label="Completed" count={doneCount} active={filter === 'done'} onPress={() => setFilter('done')} />
          </View>
          <ErrorText message={error} />
        </View>
      }
      ListEmptyComponent={!loading && !error ? (
        <Card style={{ gap: space.sm }}>
          <Text style={h.value}>No tasks yet</Text>
          <Text style={h.muted}>Approve a risk to turn its suggested actions into tracked tasks.</Text>
        </Card>
      ) : null}
      ListFooterComponent={shown.length > 0 ? <Text style={[h.label, { marginTop: space.md }]}>1–{shown.length} of {shown.length} results</Text> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => nav.openRisk(item.riskId)} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.85 }}>
          <View style={s.row}>
            <Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={item.done ? colors.ok : colors.muted} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[s.task, item.done && s.taskDone]}>{item.text}</Text>
              <View style={s.meta}>
                <Ionicons name="person-circle-outline" size={14} color={colors.muted} />
                <Text style={s.metaText}>{item.owner}</Text>
                <Text style={s.metaText}>· Source {item.riskId}</Text>
                <View style={{ flex: 1 }} />
                <StatusChip label={item.done ? 'Completed' : 'Open'} color={item.done ? colors.ok : colors.accent} />
              </View>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: 130 },
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: space.md, backgroundColor: colors.card, borderRadius: 14, padding: space.md, borderWidth: 1, borderColor: colors.line },
  task: { fontFamily: font.regular, color: colors.text, fontSize: 14, lineHeight: 20 },
  taskDone: { color: colors.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
});
