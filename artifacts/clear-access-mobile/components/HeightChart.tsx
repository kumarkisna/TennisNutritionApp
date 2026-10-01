import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { HeightRecord, Person } from '@/lib/local-api';
import { useColors } from '@/hooks/useColors';
import { F, Muted } from '@/components/ui';
import {
  assessCdcEligibility,
  CDC_STATURE_ROWS,
  getCdcHeightDomain,
  getHistoryPlot,
  type GrowthReferenceSex,
} from '@/lib/growth';

type Props = {
  mode: 'cdc' | 'history';
  records: HeightRecord[];
  person: Pick<Person, 'dateOfBirth' | 'growthReferenceSex'>;
  today: string;
};

const HEIGHT = 252;
const MARGIN = { top: 14, right: 14, bottom: 38, left: 46 };
function pathFor(values: { x: number; y: number }[]) {
  return values.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function pointInteraction(onSelect: () => void) {
  // react-native-svg 15.15.4 web prepare overwrites onClick with onPress unless
  // onPress is explicitly null; the null avoids adding native responder props.
  return Platform.OS === 'web'
    ? { onClick: onSelect, onPress: null as never }
    : { onPress: onSelect };
}
function LegendItem({ color, label, dash }: { color: string; label: string; dash?: string }) {
  const c = useColors();
  return <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12, marginBottom: 6 }}>
    <View style={{
      width: 17,
      height: 3,
      borderRadius: 2,
      backgroundColor: dash ? 'transparent' : color,
      ...(dash ? { borderBottomWidth: 1.5, borderBottomColor: color, borderStyle: 'dashed' as const } : null),
    }} />
    <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: c.mutedForeground }}>{label}</Text>
  </View>;
}

function dateTick(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export default function HeightChart({ mode, records, person, today }: Props) {
  const c = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(260, Math.min(520, windowWidth - 80));
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const chartColors = { median: c.primary, edge: c.mutedForeground, measurement: c.coral };

  const historyPlot = useMemo(() => getHistoryPlot(records), [records]);
  const chronological = historyPlot.points;

  if (mode === 'history') {
    const single = chronological.length === 1;
    const yMin = historyPlot.heightDomain.min;
    const yMax = historyPlot.heightDomain.max;
    const yAt = (fraction: number) => MARGIN.top + fraction * plotHeight;
    const xAt = (fraction: number) => MARGIN.left + fraction * plotWidth;
    const line = pathFor(chronological.map(point => ({
      x: xAt(point.xFraction),
      y: yAt(point.yFraction),
    })));
    const selected = chronological.find(point => point.id === selectedId) ?? chronological[chronological.length - 1];
    const yTicks = [0, 0.5, 1];

    return <View accessible accessibilityRole="image" accessibilityLabel="All saved height measurements plotted against their dates" style={{ gap: 8 }}>
      <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
        {yTicks.map((fraction, index) => {
          const y = MARGIN.top + plotHeight * fraction;
          const height = yMax - (yMax - yMin) * fraction;
          return <SvgGLine key={`grid-${index}`} x1={MARGIN.left} x2={width - MARGIN.right} y={y} color={c.border}>
            <SvgText x={MARGIN.left - 7} y={y + 4} textAnchor="end" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{height.toFixed(0)}</SvgText>
          </SvgGLine>;
        })}
        <Line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={HEIGHT - MARGIN.bottom} stroke={c.input} strokeWidth={1} />
        <Line x1={MARGIN.left} y1={HEIGHT - MARGIN.bottom} x2={width - MARGIN.right} y2={HEIGHT - MARGIN.bottom} stroke={c.input} strokeWidth={1} />
        {chronological.length > 1 ? <Path d={line} fill="none" stroke={chartColors.measurement} strokeWidth={2.5} /> : null}
        {chronological.map(point => {
          const selectedPoint = selected?.id === point.id;
          return <Circle key={point.id} cx={xAt(point.xFraction)} cy={yAt(point.yFraction)} r={selectedPoint ? 6 : 4.5}
            fill={chartColors.measurement} stroke={c.card} strokeWidth={2} {...pointInteraction(() => setSelectedId(point.id))} />;
        })}
        {historyPlot.firstDate ? <SvgText x={MARGIN.left} y={HEIGHT - 12} textAnchor="start" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{dateTick(historyPlot.firstDate)}</SvgText> : null}
        {historyPlot.lastDate && historyPlot.lastDate !== historyPlot.firstDate ? <SvgText x={width - MARGIN.right} y={HEIGHT - 12} textAnchor="end" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{dateTick(historyPlot.lastDate)}</SvgText> : null}
        {single ? <SvgText x={MARGIN.left + plotWidth / 2} y={HEIGHT - 12} textAnchor="middle" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{dateTick(historyPlot.firstDate!)}</SvgText> : null}
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <LegendItem color={chartColors.measurement} label="Your saved heights" />
        <Muted>Height (cm) · date</Muted>
      </View>
      {selected ? <Text accessibilityLiveRegion="polite" testID="height-chart-point-detail" style={{ fontFamily: F.semi, fontSize: 12, color: c.foreground }}>
        {selected.date} · {selected.heightCm} cm
      </Text> : null}
    </View>;
  }

  const sex = person.growthReferenceSex as GrowthReferenceSex | null;
  if (!sex) return <View style={{ paddingVertical: 12 }}>
    <Muted>Choose a CDC reference sex in the profile to show the official CDC comparison. Your saved measurements remain available in All-height history.</Muted>
  </View>;

  const referenceRows = CDC_STATURE_ROWS.filter(row => row.sex === sex);
  const eligibility = records.map(record => ({
    record,
    result: assessCdcEligibility(record, person.dateOfBirth, sex, today),
  }));
  const eligiblePoints = eligibility.filter(
    (item): item is typeof item & { result: Extract<typeof item.result, { eligible: true }> } => item.result.eligible,
  );
  const { min: yMin, max: yMax } = getCdcHeightDomain(
    sex,
    records,
    person.dateOfBirth,
    today,
  );
  const xAtAge = (ageYears: number) => MARGIN.left + ((ageYears - 2) / 18) * plotWidth;
  const yAtHeight = (height: number) => MARGIN.top + ((yMax - height) / (yMax - yMin)) * plotHeight;
  const curve = (key: 'p5' | 'p50' | 'p95') => pathFor(referenceRows.map(row => ({
    x: xAtAge(row.ageMonths / 12),
    y: yAtHeight(row[key]),
  })));
  const selected = eligiblePoints.find(point => point.record.id === selectedId) ?? eligiblePoints[eligiblePoints.length - 1];
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index) / 4);

  return <View accessible accessibilityRole="image" accessibilityLabel={`${sex === 'male' ? 'Boys' : 'Girls'} CDC stature-for-age reference and saved measurements`} style={{ gap: 8 }}>
    <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
      {yTicks.map(height => {
        const y = yAtHeight(height);
        return <SvgGLine key={`grid-${height}`} x1={MARGIN.left} x2={width - MARGIN.right} y={y} color={c.border}>
          <SvgText x={MARGIN.left - 7} y={y + 4} textAnchor="end" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{height.toFixed(0)}</SvgText>
        </SvgGLine>;
      })}
      <Line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={HEIGHT - MARGIN.bottom} stroke={c.input} strokeWidth={1} />
      <Line x1={MARGIN.left} y1={HEIGHT - MARGIN.bottom} x2={width - MARGIN.right} y2={HEIGHT - MARGIN.bottom} stroke={c.input} strokeWidth={1} />
      {[2, 5, 10, 15, 20].map(age => <SvgText key={`age-${age}`} x={xAtAge(age)} y={HEIGHT - 12} textAnchor="middle" fontFamily={F.medium} fontSize={10} fill={c.mutedForeground}>{age}</SvgText>)}
      <Path d={curve('p5')} fill="none" stroke={chartColors.edge} strokeDasharray="4 4" strokeWidth={1.5} />
      <Path d={curve('p50')} fill="none" stroke={chartColors.median} strokeWidth={2.1} />
      <Path d={curve('p95')} fill="none" stroke={chartColors.edge} strokeDasharray="4 4" strokeWidth={1.5} />
      {eligiblePoints.map(({ record, result }) => {
        const selectedPoint = selected?.record.id === record.id;
        return <Circle key={record.id} cx={xAtAge(result.ageYears)} cy={yAtHeight(record.heightCm)} r={selectedPoint ? 6 : 4.5}
          fill={chartColors.measurement} stroke={c.card} strokeWidth={2} {...pointInteraction(() => setSelectedId(record.id))} />;
      })}
    </Svg>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      <LegendItem color={chartColors.edge} dash="dashed" label="CDC 5th & 95th" />
      <LegendItem color={chartColors.median} label="CDC 50th" />
      <LegendItem color={chartColors.measurement} label="Your measurements" />
    </View>
    <Muted>Age (years) → · stature (cm) ↑ · CDC {sex === 'male' ? 'boys' : 'girls'} reference</Muted>
    {selected ? <Text accessibilityLiveRegion="polite" testID="height-chart-point-detail" style={{ fontFamily: F.semi, fontSize: 12, color: c.foreground }}>
      {selected.record.date} · {selected.record.heightCm} cm · approx. {selected.result.ageYears.toFixed(1)} years · CDC percentile approx. {selected.result.percentile?.toFixed(0) ?? '—'}
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