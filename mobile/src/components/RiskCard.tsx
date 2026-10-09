import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SeverityBadge, Tag } from '../ui';
import { colors, font, levelColor, space } from '../theme';
import { Risk } from '../types';

const num = (id: string) => id.replace(/^\D+0*/, '') || id;

/** List row like "#6 Cybersecurity Breach … 20 EXTREME". `featured` adds an accent border. */
export function RiskCard({ risk, onPress, featured }: { risk: Risk; onPress: () => void; featured?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <View style={[s.card, featured && { borderColor: colors.accent + '99' }]}>
        <View style={s.top}>
          <Text style={s.title} numberOfLines={2}>
            <Text style={s.num}>#{num(risk.risk_id)} </Text>
            {risk.statement}
          </Text>
          <View style={s.scoreCol}>
            <Text style={[s.score, { color: levelColor[risk.level] }]}>{risk.score}</Text>
            <SeverityBadge level={risk.level} />
          </View>
        </View>
        <View style={s.tags}>
          <Tag label={risk.category === 'it' ? 'IT' : risk.category === 'infosec' ? 'InfoSec' : risk.category} />
          <Tag label={risk.status} color={risk.status === 'escalated' ? colors.warn : risk.status === 'approved' ? colors.ok : undefined} />
          {risk.needs_review && <Tag label="needs review" color={colors.warn} />}
          {risk.source && <Tag label={risk.source} />}
          <Text style={s.meta}>L{risk.probability} × C{risk.impact}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  top: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  title: { flex: 1, fontFamily: font.medium, color: colors.text, fontSize: 14, lineHeight: 20 },
  num: { fontFamily: font.regular, color: colors.muted },
  scoreCol: { alignItems: 'flex-end', gap: 4 },
  score: { fontFamily: font.bold, fontSize: 20, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  meta: { fontFamily: font.regular, color: colors.muted, fontSize: 11, marginLeft: 2 },
});
