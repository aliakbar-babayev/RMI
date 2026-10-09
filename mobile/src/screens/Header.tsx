import { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNav } from '../nav';
import { getRole } from '../api';
import { colors, font, space } from '../theme';

/** Top bar: role avatar, optional centered title, optional right-side content or count badge. */
export function Header({ count, title, right }: { count?: number; title?: string; right?: ReactNode }) {
  const role = getRole();
  const nav = useNav();
  return (
    <View style={s.row}>
      <Pressable onPress={nav.openSettings} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} style={s.avatar}>
        <Text style={s.avatarText}>{role[0].toUpperCase()}</Text>
      </Pressable>
      {title ? (
        <View style={s.brand}>
          <Image source={require('../../assets/rmi-mark.png')} style={s.mark} accessibilityLabel="RMI" />
          <Text style={s.title} numberOfLines={1}>{title}</Text>
        </View>
      ) : <Text style={s.role}>{role}</Text>}
      <View style={s.right}>
        {right}
        {right === undefined && count !== undefined && (
          <View style={s.count}><Text style={s.countText}>{count}</Text></View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg, minHeight: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  avatarText: { fontFamily: font.semibold, color: colors.accent, fontSize: 15 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mark: { width: 24, height: 24, borderRadius: 6 },
  title: { flexShrink: 1, textAlign: 'center', fontFamily: font.semibold, color: colors.text, fontSize: 17 },
  role: { flex: 1, fontFamily: font.medium, color: colors.text, fontSize: 14, textTransform: 'capitalize' },
  right: { minWidth: 40, alignItems: 'flex-end' },
  count: { backgroundColor: colors.accent, borderRadius: 12, minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countText: { fontFamily: font.semibold, color: '#fff', fontSize: 12 },
});
