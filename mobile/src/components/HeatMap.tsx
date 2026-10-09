import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, levelColor, matrixColor, space } from '../theme';
import { HeatCell } from '../types';

const num = (id: string) => id.replace(/^\D+0*/, '') || id;
const MAX_MARKERS = 4;

// Likelihood on the vertical axis (5 at the top), consequence on the horizontal axis.
// Each risk is a small numbered marker inside its cell.
export function HeatMap({ cells, onCell, selected }: { cells: HeatCell[]; onCell: (cell: HeatCell) => void; selected?: string | null }) {
  const byKey = new Map(cells.map((c) => [`${c.p}-${c.i}`, c]));
  return (
    <View>
      <Text style={s.axisTitle}>Likelihood ↑</Text>
      <View style={{ gap: 5 }}>
        {[5, 4, 3, 2, 1].map((p) => (
          <View key={p} style={s.row}>
            <Text style={s.axis}>{p}</Text>
            {[1, 2, 3, 4, 5].map((i) => {
              const key = `${p}-${i}`;
              const c = byKey.get(key) ?? { p, i, open: 0, total: 0, risk_ids: [] };
              const extra = c.risk_ids.length - MAX_MARKERS;
              return (
                <Pressable
                  key={i}
                  disabled={c.total === 0}
                  onPress={() => onCell(c)}
                  accessibilityLabel={`Likelihood ${p}, consequence ${i}, ${c.open} open of ${c.total}`}
                  style={[s.cell, { backgroundColor: matrixColor(p, i) }, selected === key && s.selected]}
                >
                  <View style={s.markers}>
                    {c.risk_ids.slice(0, MAX_MARKERS).map((id) => (
                      <View key={id} style={s.marker}><Text style={s.markerText}>{num(id)}</Text></View>
                    ))}
                    {extra > 0 && <View style={[s.marker, s.more]}><Text style={s.markerText}>+{extra}</Text></View>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={s.row}>
        <Text style={s.axis} />
        {[1, 2, 3, 4, 5].map((i) => <Text key={i} style={s.axisX}>{i}</Text>)}
      </View>
      <Text style={[s.axisTitle, { marginTop: 4 }]}>Consequence →</Text>
      <View style={s.legend}>
        {(['low', 'medium', 'high', 'critical'] as const).map((l) => (
          <View key={l} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: levelColor[l] }]} />
            <Text style={s.legendText}>{l === 'critical' ? 'Extreme' : l[0].toUpperCase() + l.slice(1)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  axisTitle: { fontFamily: font.regular, color: colors.muted, fontSize: 11, textAlign: 'center', marginBottom: 6 },
  axis: { width: 14, fontFamily: font.regular, color: colors.muted, fontSize: 11, textAlign: 'center' },
  axisX: { flex: 1, fontFamily: font.regular, color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 6 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 7, padding: 3 },
  selected: { borderWidth: 2, borderColor: '#fff' },
  markers: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  marker: { minWidth: 15, height: 15, borderRadius: 8, backgroundColor: '#c0262b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1, borderColor: '#ffffffaa' },
  more: { backgroundColor: '#00000088' },
  markerText: { fontFamily: font.semibold, color: '#fff', fontSize: 8, lineHeight: 11 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.md, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontFamily: font.regular, color: colors.muted, fontSize: 11 },
});
