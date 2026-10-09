import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../theme';
import { TabKey } from '../nav';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const TABS: { key: TabKey; label: string; icon: IconName; iconOn: IconName }[] = [
  { key: 'overview', label: 'Overview', icon: 'pie-chart-outline', iconOn: 'pie-chart' },
  { key: 'risks', label: 'Risks', icon: 'grid-outline', iconOn: 'grid' },
  { key: 'register', label: 'Register', icon: 'list-outline', iconOn: 'list' },
  { key: 'actions', label: 'Actions', icon: 'checkmark-done-outline', iconOn: 'checkmark-done' },
  { key: 'add', label: 'Add', icon: 'add-circle-outline', iconOn: 'add-circle' },
];

function TabItem({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) {
  const t = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: on ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [on, t]);
  const color = t.interpolate({ inputRange: [0, 1], outputRange: [colors.muted, colors.accent] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <Pressable onPress={onPress} style={s.item} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={icon} size={22} color={on ? colors.accent : colors.muted} />
      </Animated.View>
      <Animated.Text style={[s.label, { color }]}>{label}</Animated.Text>
    </Pressable>
  );
}

/** Docked tab bar with a soft indicator that glides to the active tab. */
export function TabBar({ tab, onChange, bottomInset }: { tab: TabKey; onChange: (t: TabKey) => void; bottomInset: number }) {
  const [width, setWidth] = useState(0);
  const index = TABS.findIndex((t) => t.key === tab);
  const x = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, damping: 18, stiffness: 180, mass: 0.8 }).start();
  }, [index, x]);

  const itemW = width / TABS.length;
  const pillW = Math.max(0, itemW - 14);
  const translateX = x.interpolate({ inputRange: [0, TABS.length - 1], outputRange: [7, 7 + itemW * (TABS.length - 1)] });

  return (
    <View style={[s.bar, { paddingBottom: Math.max(bottomInset, 10) }]}>
      <View style={s.row} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && <Animated.View style={[s.indicator, { width: pillW, transform: [{ translateX }] }]} />}
        {TABS.map((t) => (
          <TabItem key={t.key} label={t.label} icon={tab === t.key ? t.iconOn : t.icon} on={tab === t.key} onPress={() => onChange(t.key)} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18,18,22,0.97)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#3a3a42',
    paddingTop: 8, paddingHorizontal: 8,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 16,
  },
  row: { flexDirection: 'row' },
  indicator: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 16, backgroundColor: 'rgba(244,123,32,0.13)' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 3 },
  label: { fontFamily: font.medium, fontSize: 11 },
});
