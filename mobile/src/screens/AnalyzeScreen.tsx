import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../api';
import { RiskCard } from '../components/RiskCard';
import { Button, Card, ErrorText, Pill, Tile, h } from '../ui';
import { colors, font, space } from '../theme';
import { Analysis, Sample } from '../types';
import { Header } from './Header';
import { LibraryList } from './LibraryList';

export function AnalyzeScreen({ onDone, onOpen }: { onDone: () => void; onOpen: (id: string) => void }) {
  const [view, setView] = useState<'document' | 'library'>('document');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);

  useEffect(() => { api.samples().then(setSamples).catch(() => setSamples([])); }, []);

  async function run() {
    setBusy(true); setError(''); setResult(null);
    try {
      setResult(await api.analyze(text, source));
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Analysis failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Header title="Add risks" />
      <View style={s.segment}>
        {(['document', 'library'] as const).map((v) => (
          <Pill key={v} label={v === 'document' ? 'Analyze document' : 'Risk library'} active={view === v} onPress={() => setView(v)} />
        ))}
      </View>
      {view === 'library' ? <LibraryList /> : (<>
      <Text style={h.muted}>Paste project notes. The AI proposes risks with evidence; you make the decision.</Text>

      {samples.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {samples.map((sm) => (
            <Pill
              key={sm.id}
              label={`${sm.language.toUpperCase()} · ${sm.title}`}
              active={picked === sm.id}
              onPress={() => { setPicked(sm.id); setText(sm.text); setSource(sm.source ?? ''); }}
            />
          ))}
        </ScrollView>
      )}

      <Card style={{ gap: space.sm }}>
        <Text style={h.label}>Document text</Text>
        <TextInput
          style={s.input}
          multiline
          value={text}
          onChangeText={(t) => { setText(t); setPicked(null); }}
          placeholder="Project notes, meeting minutes, post-mortem…"
          placeholderTextColor={colors.muted}
        />
        <Text style={h.label}>Source (optional)</Text>
        <TextInput
          style={[s.input, { minHeight: 46 }]}
          value={source}
          onChangeText={setSource}
          placeholder="e.g. prod-web-02"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
        <View style={{ marginTop: space.sm }}>
          <Button label={busy ? 'Analyzing…' : 'Analyze risks'} disabled={busy || !text.trim()} onPress={run} />
        </View>
        {busy && (
          <View style={s.busy}>
            <ActivityIndicator color={colors.indigo} />
            <Text style={h.muted}>A local model can take a few minutes.</Text>
          </View>
        )}
        <ErrorText message={error} />
      </Card>

      {result && (
        <View style={{ marginTop: space.xl, gap: space.md }}>
          <View style={s.tiles}>
            <Tile label="Risks found" value={result.risks.length} tint={colors.lavender} dot={colors.indigo} style={{ flex: 1 }} />
            <Tile label="Need review" value={result.stats.needs_review ?? 0} tint={colors.pink} dot={colors.magenta} style={{ flex: 1 }} />
            <Tile label="Quotes dropped" value={result.stats.dropped_quotes ?? 0} tint={colors.sky} style={{ flex: 1 }} />
          </View>
          {result.risks.map((r, n) => <RiskCard key={r.risk_id} risk={r} featured={n === 0} onPress={() => onOpen(r.risk_id)} />)}
        </View>
      )}
      </>)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, paddingTop: space.xl, paddingBottom: 120 },
  segment: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  chips: { gap: space.sm, paddingVertical: space.lg },
  input: { fontFamily: font.regular, backgroundColor: colors.input, color: colors.text, borderRadius: 18, padding: space.md, minHeight: 170, textAlignVertical: 'top', fontSize: 14 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center', marginTop: space.sm },
  tiles: { flexDirection: 'row', gap: space.sm },
});
