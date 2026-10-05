import { useMemo, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { WeightRecord } from '@/lib/local-api';
import { useColors } from '@/hooks/useColors';
import { F, Muted } from '@/components/ui';

const HEIGHT = 232;
const MARGIN = { top: 16, right: 16, bottom: 38, left: 52 };

function pathFor(values: { x: number; y: number }[]) {
  return values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function dateTick(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function pointInteraction(onSelect: () => void) {
  return Platform.OS === 'web'
    ? { onClick: onSelect, onPress: null as never }
    : { onPress: onSelect };
}

export default function WeightChart({ records, targetWeightKg }: {
  records: WeightRecord[];
  targetWeightKg: number | null;
}) {
  const c = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(260, Math.min(520, windowWidth - 80));
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const ascending = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
    [records],
  );
  if (ascending.length === 0) return <Muted>No weigh-ins to chart yet.</Muted>;
  const minObserved = Math.min(...ascending.map(record => record.weightKg), targetWeightKg ?? Infinity);
  const maxObserved = Math.max(...ascending.map(record => record.weightKg), targetWeightKg ?? -Infinity);
  const padding = Math.max(1, (maxObserved - minObserved) * 0.15);
  const min = minObserved - padding;
  const max = maxObserved + padding;
  const yAt = (weight: number) => MARGIN.top + ((max - weight) / (max - min)) * plotHeight;
  const dates = ascending.map(record => new Date(`${record.date}T00:00:00Z`).getTime());
  const firstDate = dates[0] ?? 0;
  const lastDate = dates[dates.length - 1] ?? 0;
  const xAt = (timestamp: number) => firstDate === lastDate
    ? MARGIN.left + plotWidth / 2
    : MARGIN.left + ((timestamp - firstDate) / (lastDate - firstDate)) * plotWidth;
  const points = ascending.map((record, index) => ({
    ...record,
    x: xAt(dates[index]),
    y: yAt(record.weightKg),
  }));
  const selected = points.find(point => point.id === selectedId) ?? points[points.length - 1];
  const line = pathFor(points);
  const yTicks = [max, (max + min) / 2, min];

  return <View accessible accessibilityRole="image" accessibilityLabel="Dated weigh-ins and optional target weight" style={{ gap: 8 }}>
    <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
      {yTicks.map((weight, index) => {
        const y = yAt(weight);
        return <SvgGLine key={`grid-${index}`} x1={MARGIN.left} x2={width - MARGIN.right} y={y} color={c.border}>
          <SvgText x={MARGIN.left - 7} y={y + 4} textAnchor="end" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>
            {weight.toFixed(1)}
          </SvgText>
        </SvgGLine>;
      })}
      <Line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={HEIGHT - MARGIN.bottom} stroke={c.input} strokeWidth={1} />
      <Line x1={MARGIN.left} y1={HEIGHT - MARGIN.bottom} x2={width - MARGIN.right} y2={HEIGHT - MARGIN.bottom} stroke={c.input} strokeWidth={1} />
      {targetWeightKg !== null ? <Line
        x1={MARGIN.left}
        y1={yAt(targetWeightKg)}
        x2={width - MARGIN.right}
        y2={yAt(targetWeightKg)}
        stroke={c.primary}
        strokeDasharray="5 4"
        strokeWidth={1.8}
      /> : null}
      {points.length > 1 ? <Path d={line} fill="none" stroke={c.chartMeasurement} strokeWidth={2.5} /> : null}
      {points.map(point => <Circle
        key={point.id}
        cx={point.x}
        cy={point.y}
        r={selected?.id === point.id ? 6 : 4.5}
        fill={c.chartMeasurement}
        stroke={c.card}
        strokeWidth={2}
        {...pointInteraction(() => setSelectedId(point.id))}
      />)}
      {ascending.length > 0 ? <>
        <SvgText x={MARGIN.left} y={HEIGHT - 12} textAnchor="start" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{dateTick(ascending[0].date)}</SvgText>
        {ascending.length > 1 ? <SvgText x={width - MARGIN.right} y={HEIGHT - 12} textAnchor="end" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{dateTick(ascending[ascending.length - 1].date)}</SvgText> : null}
      </> : null}
    </Svg>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <View accessible accessibilityLabel="Your weigh-ins" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: c.chartMeasurement }} />
        <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: c.mutedForeground }}>Weigh-ins</Text>
      </View>
      {targetWeightKg !== null ? <View accessible accessibilityLabel="Saved target weight" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 16, borderBottomWidth: 1.5, borderBottomColor: c.primary, borderStyle: 'dashed' }} />
        <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: c.mutedForeground }}>Target · {targetWeightKg.toFixed(1)} kg</Text>
      </View> : null}
      <Muted>kg · date</Muted>
    </View>
    {selected ? <Text accessibilityLiveRegion="polite" testID="weight-chart-point-detail" style={{ fontFamily: F.semi, fontSize: 12, color: c.foreground }}>
      {selected.date} · {selected.weightKg.toFixed(1)} kg
    </Text> : null}
  </View>;
}

function SvgGLine({ x1, x2, y, color, children }: {
  x1: number;
  x2: number;
  y: number;
  color: string;
  children: ReactNode;
}) {
  return <>
    <Line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={1} />
    {children}
  </>;
}
