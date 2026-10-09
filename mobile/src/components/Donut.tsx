import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, font, space } from '../theme';

/** Ring chart with a total in the middle and a legend, like "Task status". */
export function Donut({ parts, total, caption }: { parts: { label: string; value: number; color: string }[]; total: number; caption: string }) {
  const size = 116, stroke = 11, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={s.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
          {total > 0 && parts.map((p) => {
            const len = (p.value / total) * c;
            const el = (
              <Circle key={p.label} cx={size / 2} cy={size / 2} r={r} stroke={p.color} strokeWidth={stroke} fill="none"
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
            );
            offset += len;
            return el;
          })}
        </Svg>
        <View style={s.center}>
          <Text style={s.total}>{total}</Text>
          <Text style={s.caption}>{caption}</Text>
        </View>
      </View>
      <View style={s.legend}>
        {parts.map((p) => (
          <View key={p.label} style={s.item}>
            <View style={[s.sw, { backgroundColor: p.color }]} />
            <Text style={s.label}>{p.label}</Text>
            <Text style={s.value}>{p.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  total: { fontFamily: font.semibold, color: colors.text, fontSize: 24, lineHeight: 28 },
  caption: { fontFamily: font.regular, color: colors.muted, fontSize: 10 },
  legend: { flex: 1, gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sw: { width: 9, height: 9, borderRadius: 2 },
  label: { flex: 1, fontFamily: font.regular, color: colors.text, fontSize: 13 },
  value: { fontFamily: font.semibold, color: colors.text, fontSize: 13 },
});
