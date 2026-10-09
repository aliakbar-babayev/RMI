import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../api';
import { RiskCard } from '../components/RiskCard';
import { Button, Card, ErrorText, Pill, Tile, h } from '../ui';
import { colors, font, space } from '../theme';
import { Analysis, Sample } from '../types';
import { Header } from './Header';
import { LibraryList } from './LibraryList';
import { ProjectPicker } from './ProjectPicker';
import { DemoProject, PROJECTS } from '../projects';
import { useNav } from '../nav';

export function AnalyzeScreen({ onDone, onOpen }: { onDone: () => void; onOpen: (id: string) => void }) {
  const nav = useNav();
  const [view, setView] = useState<'projects' | 'document' | 'library'>('projects');
  const [language, setLanguage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<DemoProject | null>(null);
  const [bulk, setBulk] = useState<{ done: number; current: string; results: { p: DemoProject; risks?: number; error?: string }[] } | null>(null);
  const stopRef = useRef(false);
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
      setResult(await api.analyze(text, source, language ?? undefined));
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Analysis failed.');
    } finally {
      setBusy(false);
    }
  }

  function pickProject(p: DemoProject) {
    setLoaded(p); setPicked(null); setText(p.text); setSource(p.source); setLanguage(p.language);
    setResult(null); setError(''); setView('document');
  }

  // Analyze every demo project one after another; each one is a normal POST /analyses.
  async function analyzeAll() {
    stopRef.current = false;
    const results: { p: DemoProject; risks?: number; error?: string }[] = [];
    for (let n = 0; n < PROJECTS.length && !stopRef.current; n++) {
      const p = PROJECTS[n];
      setBulk({ done: n, current: p.name, results: [...results] });
      try {
        const a = await api.analyze(p.text, p.source, p.language);
        results.push({ p, risks: a.risks.length });
      } catch (e) {
        results.push({ p, error: e instanceof ApiError ? e.message : 'failed' });
      }
    }
    setBulk({ done: results.length, current: '', results });
    nav.refresh();
  }
  const bulkRunning = !!bulk && bulk.current !== '';

  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Header title="Add risks" />
      <View style={s.segment}>
        {(['projects', 'document', 'library'] as const).map((v) => (
          <Pill key={v} label={v === 'projects' ? 'Demo projects' : v === 'document' ? 'Document' : 'Risk library'} active={view === v} onPress={() => setView(v)} />
        ))}
      </View>
      {view === 'projects' && (
        <View style={{ gap: space.md }}>
          <Text style={h.muted}>Realistic project files with hidden risks (EN, plus Azerbaijani and Russian versions). Tap one to load it, or analyze them all.</Text>
          {bulk && (
            <Card style={{ gap: space.sm }}>
              <Text style={h.value}>
                {bulkRunning ? `Analyzing ${bulk.done + 1} of ${PROJECTS.length}: ${bulk.current}…` : `Finished ${bulk.results.length} of ${PROJECTS.length}`}
              </Text>
              {bulk.results.map((r) => (
                <Text key={r.p.id} style={[h.muted, r.error ? { color: colors.danger } : null]}>
                  {r.p.id} {r.p.name}: {r.error ? r.error : `${r.risks} risks`}
                </Text>
              ))}
              {bulkRunning
                ? <Button label="Stop after this one" kind="ghost" small onPress={() => { stopRef.current = true; }} />
                : <Button label="Open Risks tab" small onPress={() => nav.goTab('risks')} />}
            </Card>
          )}
          <Button label={bulkRunning ? 'Analyzing…' : `Analyze all ${PROJECTS.length} projects`} disabled={bulkRunning} onPress={analyzeAll} />
          <Text style={h.label}>Each analysis is saved under the project name, so the Projects tab groups its risks.</Text>
          <ProjectPicker selected={loaded?.id ?? null} onPick={pickProject} />
        </View>
      )}
      {view === 'library' && <LibraryList />}
      {view === 'document' && (<>
      {loaded && (
        <Card style={s.loaded}>
          <Text style={h.value}>Loaded {loaded.code} · {loaded.name} ({loaded.language.toUpperCase()})</Text>
          <Text style={h.label}>Source: {loaded.source} · {loaded.text.length.toLocaleString()} characters</Text>
        </Card>
      )}
      <Text style={h.muted}>Paste project notes. The AI proposes risks with evidence; you make the decision.</Text>

      {samples.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {samples.map((sm) => (
            <Pill
              key={sm.id}
              label={`${sm.language.toUpperCase()} · ${sm.title}`}
              active={picked === sm.id}
              onPress={() => { setPicked(sm.id); setText(sm.text); setSource(sm.source ?? ''); setLanguage(sm.language); setLoaded(null); }}
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
          onChangeText={(t) => { setText(t); setPicked(null); setLoaded(null); setLanguage(null); }}
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
  segment: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg, flexWrap: 'wrap' },
  loaded: { marginTop: space.md, gap: 2, borderColor: colors.accent + '88' },
  chips: { gap: space.sm, paddingVertical: space.lg },
  input: { fontFamily: font.regular, backgroundColor: colors.input, color: colors.text, borderRadius: 18, padding: space.md, minHeight: 170, maxHeight: 320, textAlignVertical: 'top', fontSize: 14 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center', marginTop: space.sm },
  tiles: { flexDirection: 'row', gap: space.sm },
});
