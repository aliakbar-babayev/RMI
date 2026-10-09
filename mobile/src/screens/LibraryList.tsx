import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { Button, ChipRow, SearchBar, Tag, h } from '../ui';
import { colors, font, space } from '../theme';
import { CATEGORY_LABEL } from '../labels';
import { LIBRARY } from '../library';
import { Category } from '../types';
import { useNav } from '../nav';

type RowState = { busy?: boolean; added?: string[]; error?: string };

/** Risk library: pick a common scenario; the AI assesses it and it lands in the register as a pending risk. */
export function LibraryList() {
  const nav = useNav();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  async function add(id: string, text: string) {
    setRows((r) => ({ ...r, [id]: { busy: true } }));
    try {
      const a = await api.analyze(text);
      setRows((r) => ({ ...r, [id]: { added: a.risks.map((x) => x.risk_id) } }));
      nav.refresh();
    } catch (e) {
      setRows((r) => ({ ...r, [id]: { error: e instanceof ApiError ? e.message : 'Could not add.' } }));
    }
  }

  const needle = q.trim().toLowerCase();
  const shown = LIBRARY.filter((l) => (!category || l.category === category) && (!needle || l.text.toLowerCase().includes(needle)));

  return (
    <View style={{ gap: space.md }}>
      <Text style={h.muted}>Select scenarios that apply to your business. The AI scores each one and adds it to your register for review.</Text>
      <SearchBar value={q} onChange={setQ} placeholder="Search scenarios" />
      <ChipRow label="Category" value={category} onChange={setCategory}
        options={(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => ({ key: k, label: CATEGORY_LABEL[k] }))} />
      {shown.map((l) => {
        const st = rows[l.id] ?? {};
        return (
          <View key={l.id} style={s.row}>
            <Text style={s.text}>{l.text}</Text>
            <View style={s.bottom}>
              <Tag label={CATEGORY_LABEL[l.category]} />
              <View style={{ flex: 1 }} />
              {st.added ? (
                <Text style={s.added} onPress={() => st.added?.[0] && nav.openRisk(st.added[0])}>
                  ✓ Added {st.added.join(', ') || '(no risk found)'}
                </Text>
              ) : (
                <Button label={st.busy ? 'Assessing…' : '＋ Add'} small disabled={st.busy} onPress={() => add(l.id, l.text)} />
              )}
            </View>
            {!!st.error && <Text style={s.err}>{st.error}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: 14, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  text: { fontFamily: font.regular, color: colors.text, fontSize: 14, lineHeight: 20 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  added: { fontFamily: font.medium, color: colors.ok, fontSize: 12 },
  err: { fontFamily: font.regular, color: colors.danger, fontSize: 12 },
});
