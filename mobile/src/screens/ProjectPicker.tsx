import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '../theme';
import { DemoProject, PROJECTS } from '../projects';

const LANG_LABEL = { en: 'EN', az: 'AZ', ru: 'RU' } as const;

/** Demo project documents from data/, shown as selectable cards. */
export function ProjectPicker({ selected, onPick }: { selected: string | null; onPick: (p: DemoProject) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      {PROJECTS.map((p) => {
        const on = selected === p.id;
        return (
          <Pressable key={p.id} onPress={() => onPick(p)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={({ pressed }) => [s.card, on && s.cardOn, pressed && { opacity: 0.85 }]}>
            <View style={[s.code, on && { backgroundColor: colors.accent }]}><Text style={s.codeText}>{p.code}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name} numberOfLines={1}>{p.name}</Text>
              <Text style={s.sub} numberOfLines={1}>{p.subtitle}</Text>
              <Text style={s.industry} numberOfLines={1}>{p.industry}</Text>
            </View>
            <View style={[s.lang, p.language !== 'en' && { borderColor: colors.accent }]}>
              <Text style={[s.langText, p.language !== 'en' && { color: colors.accent }]}>{LANG_LABEL[p.language]}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, borderRadius: 14, padding: space.md, borderWidth: 1, borderColor: colors.line },
  cardOn: { borderColor: colors.accent, backgroundColor: '#1f1712' },
  code: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  codeText: { fontFamily: font.semibold, color: colors.text, fontSize: 13 },
  name: { fontFamily: font.semibold, color: colors.text, fontSize: 14 },
  sub: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
  industry: { fontFamily: font.regular, color: colors.muted, fontSize: 11 },
  lang: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  langText: { fontFamily: font.semibold, color: colors.muted, fontSize: 11 },
});
