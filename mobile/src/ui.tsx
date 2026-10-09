import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, levelColor, levelGradient, levelLabel, space } from './theme';
import { Level } from './types';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Tile({ label, value, tint, dot, style }: { label: string; value: string | number; tint?: string; dot?: string; style?: ViewStyle }) {
  return (
    <View style={[s.tile, { backgroundColor: tint ?? colors.raised }, style]}>
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
    </View>
  );
}

/** Count box per level, like "4 EXTREME / 9 HIGH / 0 MEDIUM / 0 LOW". */
export function LevelBox({ level, value, active, onPress }: { level: Level; value: number; active?: boolean; onPress?: () => void }) {
  const c = levelColor[level];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[s.levelBox, { borderColor: c + (active ? 'ff' : '66'), backgroundColor: c + (active ? '33' : '14') }]}
    >
      <Text style={[s.levelValue, { color: c }]}>{value}</Text>
      <Text style={[s.levelLabel, { color: c }]}>{levelLabel[level]}</Text>
    </Pressable>
  );
}

export function SeverityBadge({ level }: { level: Level }) {
  const c = levelColor[level];
  return (
    <View style={[s.sev, { backgroundColor: c + '26', borderColor: c + '80' }]}>
      <Text style={[s.sevText, { color: c }]}>{levelLabel[level]}</Text>
    </View>
  );
}

export function ScoreBar({ level, score }: { level: Level; score: number }) {
  const pct = Math.max(0.14, score / 25);
  return (
    <View style={s.barTrack}>
      <LinearGradient colors={levelGradient[level]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.barFill, { width: `${pct * 100}%` }]}>
        <Text style={s.barText} numberOfLines={1}>{levelLabel[level]} · {score}</Text>
      </LinearGradient>
    </View>
  );
}

export function Bubble({ value, tint }: { value: string | number; tint?: string; dark?: boolean }) {
  return (
    <View style={[s.bubble, { backgroundColor: tint ?? colors.raised }]}>
      <Text style={s.bubbleText}>{value}</Text>
    </View>
  );
}

export function Pill({ label, active, count, onPress }: { label: string; active?: boolean; count?: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.pill, active && s.pillOn]}>
      <Text style={[s.pillText, active && s.pillTextOn]}>{label}</Text>
      {count !== undefined && (
        <View style={[s.pillCount, active && { backgroundColor: '#ffffff33' }]}>
          <Text style={[s.pillCountText, active && { color: '#fff' }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Tag({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[s.tag, color ? { backgroundColor: color + '22', borderColor: color + '55' } : null]}>
      <Text style={[s.tagText, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

export function IconButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" style={s.iconBtn}>
      <Text style={s.iconText}>{label}</Text>
    </Pressable>
  );
}

/** − value + control, like the Likelihood / Consequence steppers. */
export function Stepper({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Text style={s.stepLabel}>{label}</Text>
      <View style={s.stepper}>
        <Pressable disabled={disabled || value <= 1} onPress={() => onChange(value - 1)} hitSlop={8} style={s.stepBtn}>
          <Text style={[s.stepSign, (disabled || value <= 1) && { opacity: 0.3 }]}>−</Text>
        </Pressable>
        <Text style={s.stepValue}>{value}</Text>
        <Pressable disabled={disabled || value >= 5} onPress={() => onChange(value + 1)} hitSlop={8} style={s.stepBtn}>
          <Text style={[s.stepSign, (disabled || value >= 5) && { opacity: 0.3 }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Button({
  label, onPress, kind = 'primary', disabled, small,
}: { label: string; onPress: () => void; kind?: 'primary' | 'dark' | 'danger' | 'ghost'; disabled?: boolean; small?: boolean }) {
  const bg = kind === 'primary' ? colors.accent : kind === 'danger' ? colors.danger : kind === 'dark' ? colors.raised : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg },
        kind === 'ghost' && s.btnGhost,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[s.btnText, small && { fontSize: 13 }, kind === 'ghost' && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={16} color={colors.muted} />
      <TextInput
        style={s.searchInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

/** Horizontal row of filter chips. `value` null = no filter. */
export function ChipRow<T extends string>({ label, options, value, onChange }: { label: string; options: { key: T; label: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <View style={s.chipRow}>
      <Text style={s.chipLabel}>{label}</Text>
      <View style={s.chipWrap}>
        {options.map((o) => (
          <Pill key={o.key} label={o.label} active={value === o.key} onPress={() => onChange(value === o.key ? null : o.key)} />
        ))}
      </View>
    </View>
  );
}

/** Small status chip like "Incomplete" / "OK" / "Draft". */
export function StatusChip({ label, color }: { label: string; color?: string }) {
  const c = color ?? colors.muted;
  return (
    <View style={[s.statusChip, { backgroundColor: c + '1f', borderColor: c + '55' }]}>
      <View style={[s.statusDot, { borderColor: c, backgroundColor: color ? c : 'transparent' }]} />
      <Text style={[s.statusText, { color: color ? c : colors.muted }]}>{label}</Text>
    </View>
  );
}

export function ErrorText({ message }: { message: string }) {
  return message ? <Text style={s.error}>{message}</Text> : null;
}

export const h = StyleSheet.create({
  hero: { fontFamily: font.semibold, color: colors.text, fontSize: 26, lineHeight: 34 },
  title: { fontFamily: font.semibold, color: colors.text, fontSize: 20, lineHeight: 28 },
  section: { fontFamily: font.semibold, color: colors.text, fontSize: 18, marginBottom: space.md },
  body: { fontFamily: font.regular, color: '#d6d6dc', fontSize: 14, lineHeight: 21 },
  muted: { fontFamily: font.regular, color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
  value: { fontFamily: font.medium, color: colors.text, fontSize: 14, marginTop: 4 },
});

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: space.lg, borderWidth: 1, borderColor: colors.line },
  tile: { borderRadius: 14, padding: space.md, minHeight: 84, justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line },
  dot: { position: 'absolute', top: 12, right: 12, width: 7, height: 7, borderRadius: 4 },
  tileLabel: { fontFamily: font.regular, color: colors.muted, fontSize: 12, paddingRight: 14 },
  tileValue: { fontFamily: font.semibold, color: colors.text, fontSize: 22 },
  levelBox: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: space.md, alignItems: 'center' },
  levelValue: { fontFamily: font.semibold, fontSize: 24, lineHeight: 30 },
  levelLabel: { fontFamily: font.medium, fontSize: 10, letterSpacing: 0.5 },
  sev: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  sevText: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 0.4 },
  barTrack: { height: 40, borderRadius: 10, backgroundColor: colors.raised, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 10, justifyContent: 'center', paddingHorizontal: space.md },
  barText: { fontFamily: font.semibold, color: '#fff', fontSize: 13 },
  bubble: { minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  bubbleText: { fontFamily: font.semibold, color: '#fff', fontSize: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.raised, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.line },
  pillOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { fontFamily: font.regular, color: colors.muted, fontSize: 13 },
  pillTextOn: { color: '#fff', fontFamily: font.medium },
  pillCount: { backgroundColor: colors.line, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  pillCountText: { fontFamily: font.medium, fontSize: 11, color: colors.text },
  tag: { backgroundColor: colors.raised, borderRadius: 6, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontFamily: font.regular, color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  iconText: { fontFamily: font.medium, fontSize: 22, color: colors.text, marginTop: -3 },
  stepLabel: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.raised, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.line },
  stepBtn: { width: 24, alignItems: 'center' },
  stepSign: { fontFamily: font.medium, color: colors.text, fontSize: 20 },
  stepValue: { fontFamily: font.semibold, color: colors.text, fontSize: 20, minWidth: 16, textAlign: 'center' },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnSmall: { minHeight: 34, paddingVertical: 7, paddingHorizontal: space.md, borderRadius: 9 },
  btnGhost: { borderWidth: 1, borderColor: colors.line },
  btnText: { fontFamily: font.semibold, color: '#fff', fontSize: 15 },
  error: { fontFamily: font.regular, color: colors.danger, marginTop: space.sm, fontSize: 13 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.raised, borderRadius: 12, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.line, height: 44 },
  searchInput: { flex: 1, fontFamily: font.regular, color: colors.text, fontSize: 14, paddingVertical: 0 },
  chipRow: { gap: 6 },
  chipLabel: { fontFamily: font.medium, color: colors.muted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  statusText: { fontFamily: font.medium, fontSize: 11 },
});
