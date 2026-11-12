// components/LineChart.tsx
// Dependency-free time-series line chart built from plain Views, so it needs no native rebuild.
// Round values on the Y axis, clock times on the X axis. Tap or drag to see an exact value.
import { useRef, useState } from 'react';
// Plain (transparent) Views on purpose: the themed View paints a background that would cover the layers below
import { StyleSheet, LayoutChangeEvent, GestureResponderEvent, View } from 'react-native';
import { Text, useTheme } from '@/components/Themed';

export type ChartPoint = { t: number; v: number };

export type ReferenceLine = { value: number; label: string };

type Props = {
  data: ChartPoint[];
  xDomain: [number, number];
  xTickStepMs: number; // e.g. 15 min → 9:30, 9:45, 10:00
  yAxisTitle: string; // e.g. "°C" or "pH"
  color: string;
  formatValue: (v: number) => string; // tooltip text
  formatTime: (t: number) => string;
  referenceLines?: ReferenceLine[];
  includeZero?: boolean;
  height?: number;
};

const PAD = { left: 40, right: 10, top: 22, bottom: 26 };

// Round tick values: steps of 1, 2 or 5 × 10ⁿ (…0.1, 0.2, 0.5, 1, 2, 5, 10, 20…)
function niceTicks(min: number, max: number, target = 5) {
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const rough = (max - min) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return { ticks, lo, hi, decimals };
}

// Clock-aligned time ticks in the phone's local time zone
function timeTicks(x0: number, x1: number, step: number) {
  const tz = new Date().getTimezoneOffset() * 60 * 1000;
  const ticks: number[] = [];
  for (let t = Math.ceil((x0 - tz) / step) * step + tz; t <= x1; t += step) ticks.push(t);
  return ticks;
}

export default function LineChart({
  data,
  xDomain,
  xTickStepMs,
  yAxisTitle,
  color,
  formatValue,
  formatTime,
  referenceLines = [],
  includeZero = false,
  height = 230,
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;

  const values = [...data.map((p) => p.v), ...referenceLines.map((r) => r.value)];
  if (includeZero) values.push(0);
  const y = niceTicks(Math.min(...values), Math.max(...values));

  const [x0, x1] = xDomain;
  const xOf = (t: number) => PAD.left + ((t - x0) / (x1 - x0)) * plotW;
  const yOf = (v: number) => PAD.top + (1 - (v - y.lo) / (y.hi - y.lo)) * plotH;

  const pts = data.map((p) => ({ x: xOf(p.t), y: yOf(p.v) }));
  const xTicks = timeTicks(x0, x1, xTickStepMs);

  const pickNearest = (e: GestureResponderEvent) => {
    if (pts.length === 0) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const x = e.nativeEvent.locationX;
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i;
    }
    setSelected(best);
  };

  const sel = selected !== null && selected < data.length ? selected : null;
  const axisColor = theme.textMuted;

  return (
    <View
      style={[styles.root, { height }]}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pickNearest}
      onResponderMove={pickNearest}
      onResponderRelease={() => {
        hideTimer.current = setTimeout(() => setSelected(null), 2500);
      }}
    >
      {width > 0 && (
        <>
          {/* Y axis title */}
          <Text pointerEvents="none" style={[styles.axisTitle, { left: 0, top: 0, color: axisColor }]}>
            {yAxisTitle}
          </Text>

          {/* Y ticks + light grid */}
          {y.ticks.map((v) => {
            const ty = yOf(v);
            return (
              <View key={`y${v}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[styles.gridLine, { top: ty, left: PAD.left, width: plotW, backgroundColor: theme.border }]} />
                <Text style={[styles.yLabel, { top: ty - 8, width: PAD.left - 8, color: axisColor }]}>
                  {v.toFixed(y.decimals)}
                </Text>
              </View>
            );
          })}

          {/* Axis lines */}
          <View pointerEvents="none" style={[styles.axisLine, { left: PAD.left, top: PAD.top, width: 1, height: plotH, backgroundColor: axisColor }]} />
          <View pointerEvents="none" style={[styles.axisLine, { left: PAD.left, top: PAD.top + plotH, width: plotW, height: 1, backgroundColor: axisColor }]} />

          {/* X ticks */}
          {xTicks.map((t) => {
            const tx = xOf(t);
            return (
              <View key={`x${t}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[styles.axisLine, { left: tx, top: PAD.top + plotH, width: 1, height: 4, backgroundColor: axisColor }]} />
                <Text style={[styles.xLabel, { left: tx - 25, top: PAD.top + plotH + 6, color: axisColor }]}>
                  {formatTime(t)}
                </Text>
              </View>
            );
          })}

          {/* Threshold lines */}
          {referenceLines.map((r) => (
            <View
              key={r.label}
              pointerEvents="none"
              style={[styles.refLine, { top: yOf(r.value), left: PAD.left, width: plotW, borderColor: theme.danger }]}
            />
          ))}

          {/* Line */}
          {pts.slice(1).map((p, i) => {
            const a = pts[i];
            const dx = p.x - a.x;
            const dy = p.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            return (
              <View
                key={`s${i}`}
                pointerEvents="none"
                style={[
                  styles.segment,
                  {
                    left: (a.x + p.x) / 2 - len / 2,
                    top: (a.y + p.y) / 2 - 1,
                    width: len + 1,
                    backgroundColor: color,
                    transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                  },
                ]}
              />
            );
          })}

          {/* Single point: show it as a dot so it is visible */}
          {pts.length === 1 && (
            <View
              pointerEvents="none"
              style={[styles.marker, { left: pts[0].x - 4, top: pts[0].y - 4, backgroundColor: color }]}
            />
          )}

          {/* Tap / drag: crosshair + value */}
          {sel !== null && (
            <>
              <View
                pointerEvents="none"
                style={[styles.crosshair, { left: pts[sel].x, top: PAD.top, height: plotH, backgroundColor: axisColor }]}
              />
              <View
                pointerEvents="none"
                style={[styles.markerActive, { left: pts[sel].x - 6, top: pts[sel].y - 6, backgroundColor: color, borderColor: theme.card }]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  {
                    left: Math.min(Math.max(pts[sel].x - 55, PAD.left), width - PAD.right - 110),
                    top: Math.max(pts[sel].y - 56, 0),
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={styles.tooltipValue}>{formatValue(data[sel].v)}</Text>
                <Text style={[styles.tooltipTime, { color: axisColor }]}>{formatTime(data[sel].t)}</Text>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  axisTitle: { position: 'absolute', fontSize: 11, fontWeight: '700' },
  gridLine: { position: 'absolute', height: StyleSheet.hairlineWidth, opacity: 0.6 },
  axisLine: { position: 'absolute', opacity: 0.6 },
  yLabel: { position: 'absolute', left: 0, fontSize: 11, textAlign: 'right' },
  xLabel: { position: 'absolute', width: 50, fontSize: 11, textAlign: 'center' },
  refLine: { position: 'absolute', borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.8 },
  segment: { position: 'absolute', height: 2, borderRadius: 1 },
  marker: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  markerActive: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  crosshair: { position: 'absolute', width: 1, opacity: 0.5 },
  tooltip: {
    position: 'absolute',
    width: 110,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tooltipValue: { fontSize: 14, fontWeight: '700' },
  tooltipTime: { fontSize: 11, marginTop: 1 },
});
