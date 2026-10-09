import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api';
import { HeatMap } from '../components/HeatMap';
import { RiskCard } from '../components/RiskCard';
import { Button, Card, ErrorText, IconButton, LevelBox, SeverityBadge, Tag, h } from '../ui';
import { colors, font, levelColor, space } from '../theme';
import { DemoProject, PROJECTS } from '../projects';
import { HeatCell, Level, Risk } from '../types';
import { useNav } from '../nav';
import { useRisks } from '../useRisks';
import { useAnalysisProjects } from '../useAnalysisProjects';
import { Header } from './Header';

const LEVELS: Level[] = ['critical', 'high', 'medium', 'low'];
const DECIDED = ['approved', 'edited', 'escalated', 'resolved'];

interface Project {
  name: string;               // the project name the documents were analyzed under
  subtitle: string;
  industry: string;
  versions: DemoProject[];    // language versions from data/ (empty for other sources)
  risks: Risk[];
}

function stats(risks: Risk[]) {
  const by = (l: Level) => risks.filter((r) => r.level === l).length;
  const open = risks.filter((r) => r.status !== 'resolved').length;
  const decided = risks.filter((r) => DECIDED.includes(r.status)).length;
  const worst = risks.reduce<Risk | null>((w, r) => (!w || r.score > w.score ? r : w), null);
  return { counts: { critical: by('critical'), high: by('high'), medium: by('medium'), low: by('low') } as Record<Level, number>, open, decided, worst };
}

function ProjectCard({ p, onPress }: { p: Project; onPress: () => void }) {
  const st = stats(p.risks);
  const pct = p.risks.length ? st.decided / p.risks.length : 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.icon}><Ionicons name="folder-open-outline" size={20} color={colors.accent} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.name} numberOfLines={1}>{p.name}</Text>
            <Text style={s.sub} numberOfLines={1}>{p.subtitle || 'Documents analyzed under this name'}</Text>
          </View>
          {st.worst ? <SeverityBadge level={st.worst.level} /> : <Tag label="not analyzed" />}
        </View>

        <View style={s.tags}>
          {!!p.industry && <Tag label={p.industry} />}
          {p.versions.map((v) => <Tag key={v.id} label={v.language.toUpperCase()} color={v.language === 'en' ? undefined : colors.accent} />)}
        </View>

        {p.risks.length > 0 ? (
          <>
            <View style={s.levelRow}>
              {LEVELS.map((l) => (
                <View key={l} style={s.levelItem}>
                  <View style={[s.dot, { backgroundColor: levelColor[l] }]} />
                  <Text style={s.levelNum}>{st.counts[l]}</Text>
                </View>
              ))}
              <View style={{ flex: 1 }} />
              <Text style={s.meta}>{p.risks.length} risks · {st.open} open</Text>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${pct * 100}%` }]} /></View>
            <Text style={s.meta}>{st.decided} of {p.risks.length} decided by a human</Text>
          </>
        ) : (
          <Text style={s.meta}>No risks yet. Open the project to analyze it.</Text>
        )}
      </View>
    </Pressable>
  );
}

function ProjectDetail({ p, onBack }: { p: Project; onBack: () => void }) {
  const nav = useNav();
  const [cell, setCell] = useState<{ key: string; ids: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const st = stats(p.risks);

  useEffect(() => { setCell(null); }, [p.name, p.risks.length]);

  // Matrix from this project's risks (the backend's source filter groups by system, not by project).
  const cells = useMemo<HeatCell[]>(() => {
    const out: HeatCell[] = [];
    for (let pr = 1; pr <= 5; pr++) for (let im = 1; im <= 5; im++) {
      const here = p.risks.filter((r) => r.probability === pr && r.impact === im);
      out.push({ p: pr, i: im, total: here.length, open: here.filter((r) => r.status !== 'resolved').length, risk_ids: here.map((r) => r.risk_id) });
    }
    return out;
  }, [p.risks]);

  async function analyze(v: DemoProject) {
    setBusy(v.id); setError('');
    try {
      await api.analyze(v.text, v.source, v.language);
      nav.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Analysis failed.');
    } finally {
      setBusy(null);
    }
  }

  const shown = (cell ? p.risks.filter((r) => cell.ids.includes(r.risk_id)) : p.risks).slice().sort((a, b) => b.score - a.score);

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <View style={s.detailHead}>
        <IconButton label="‹" onPress={onBack} />
        <Text style={s.detailTitle} numberOfLines={1}>{p.name}</Text>
        <View style={{ width: 40 }} />
      </View>
      {!!p.subtitle && <Text style={h.title}>{p.subtitle}</Text>}
      <View style={[s.tags, { marginTop: space.sm }]}>
        {!!p.industry && <Tag label={p.industry} />}
        {p.versions.map((v) => <Tag key={v.id} label={`${v.code} · ${v.language.toUpperCase()}`} color={v.language === 'en' ? undefined : colors.accent} />)}
      </View>

      <View style={[s.levels, { marginTop: space.lg }]}>
        {LEVELS.map((l) => <LevelBox key={l} level={l} value={st.counts[l]} />)}
      </View>

      {p.versions.length > 0 && (
        <Card style={{ marginTop: space.lg, gap: space.sm }}>
          <Text style={h.value}>Analyze this project</Text>
          <Text style={h.muted}>Each run adds the AI's risks to this project for review. Running the same file twice adds them twice.</Text>
          {p.versions.map((v) => (
            <Button key={v.id} small kind={v.language === 'en' ? 'primary' : 'dark'} disabled={!!busy}
              label={busy === v.id ? 'Analyzing…' : `Analyze ${v.language.toUpperCase()} version (${v.code})`} onPress={() => analyze(v)} />
          ))}
          {busy && <ActivityIndicator color={colors.accent} />}
          <ErrorText message={error} />
        </Card>
      )}

      <Text style={[h.section, s.gap]}>Risk matrix</Text>
      <Card>
        {p.risks.length > 0 ? (
          <HeatMap cells={cells} selected={cell?.key} onCell={(c) => {
            if (c.risk_ids.length === 1) { nav.openRisk(c.risk_ids[0]); return; }
            const key = `${c.p}-${c.i}`;
            setCell(cell?.key === key ? null : { key, ids: c.risk_ids });
          }} />
        ) : <Text style={h.muted}>No risks in this project yet.</Text>}
      </Card>

      <View style={[s.listHead, s.gap]}>
        <Text style={[h.section, { marginBottom: 0 }]}>{cell ? 'Risks in cell' : 'Risks'} ({shown.length})</Text>
        {cell && <Text style={s.clear} onPress={() => setCell(null)}>Show all</Text>}
      </View>
      <View style={{ gap: space.sm }}>
        {shown.map((r) => <RiskCard key={r.risk_id} risk={r} onPress={() => nav.openRisk(r.risk_id)} />)}
      </View>
    </ScrollView>
  );
}

export function ProjectsScreen({ refreshKey }: { refreshKey: number }) {
  const { risks, loading, error, reload } = useRisks(refreshKey);
  const { projectOf, loading: mapping } = useAnalysisProjects(risks);
  const [openName, setOpenName] = useState<string | null>(null);

  // Demo projects from data/ (language versions grouped by name), then any other risk sources.
  const projects = useMemo<{ demo: Project[]; other: Project[] }>(() => {
    const names = [...new Set(PROJECTS.map((p) => p.name))];
    const demo = names.map((name) => {
      const versions = PROJECTS.filter((p) => p.name === name);
      const main = versions.find((v) => v.language === 'en') ?? versions[0];
      return { name, subtitle: main.subtitle, industry: main.industry, versions, risks: risks.filter((r) => projectOf(r)?.toLowerCase() === name.toLowerCase()) };
    });
    const label = (r: Risk) => projectOf(r) ?? 'No project';
    // Case-insensitive: the backend's samples save projects in lowercase ("paybridge").
    const known = names.map((n) => n.toLowerCase());
    const otherNames = [...new Set(risks.map(label))].filter((n) => !known.includes(n.toLowerCase()));
    const other = otherNames.map((name) => ({
      name, subtitle: '', industry: '', versions: [], risks: risks.filter((r) => label(r) === name),
    }));
    return { demo, other };
  }, [risks, projectOf]);

  const open = [...projects.demo, ...projects.other].find((p) => p.name === openName);
  if (open) return <ProjectDetail p={open} onBack={() => setOpenName(null)} />;

  const analyzed = projects.demo.filter((p) => p.risks.length > 0).length;

  return (
    <ScrollView contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading || mapping} onRefresh={reload} tintColor={colors.accent} />}>
      <Header title="Projects" count={projects.demo.length} />
      <Text style={h.muted}>{analyzed} of {projects.demo.length} demo projects analyzed. Risks are grouped by the project their document was analyzed under.</Text>
      <ErrorText message={error} />
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {projects.demo.map((p) => <ProjectCard key={p.name} p={p} onPress={() => setOpenName(p.name)} />)}
      </View>
      {projects.other.length > 0 && (
        <>
          <Text style={[h.section, s.gap]}>Other sources</Text>
          <View style={{ gap: space.sm }}>
            {projects.other.map((p) => <ProjectCard key={p.name} p={p} onPress={() => setOpenName(p.name)} />)}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: 130 },
  gap: { marginTop: space.xl },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent + '1f', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font.semibold, color: colors.text, fontSize: 15 },
  sub: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  levelItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  levelNum: { fontFamily: font.semibold, color: colors.text, fontSize: 13 },
  meta: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.ok, borderRadius: 3 },
  detailHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  detailTitle: { fontFamily: font.semibold, color: colors.text, fontSize: 17, flex: 1, textAlign: 'center' },
  levels: { flexDirection: 'row', gap: space.sm },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  clear: { fontFamily: font.medium, color: colors.accent, fontSize: 13 },
});
