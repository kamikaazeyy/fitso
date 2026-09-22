import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '@/constants/theme';

const GRID = '#2C2C2E';
const LABEL = '#8E8E93';
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 24;
const CHART_H = 180;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatCompact(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function Gridlines({ width, ticks }: { width: number; ticks: number[] }) {
  const plotH = CHART_H - PAD_T - PAD_B;
  return (
    <>
      {ticks.map((_, i) => {
        const y = PAD_T + plotH - (i / (ticks.length - 1)) * plotH;
        return (
          <Line
            key={i}
            x1={PAD_L}
            x2={width - PAD_R}
            y1={y}
            y2={y}
            stroke={GRID}
            strokeWidth={1}
            strokeDasharray={i === 0 ? undefined : '3 4'}
          />
        );
      })}
    </>
  );
}

function YAxisLabels({ ticks, max }: { ticks: number[]; max: number }) {
  const plotH = CHART_H - PAD_T - PAD_B;
  return (
    <>
      {ticks.map((t, i) => {
        const y = PAD_T + plotH - (i / (ticks.length - 1)) * plotH;
        return (
          <SvgText
            key={t}
            x={PAD_L - 6}
            y={y + 3}
            fontSize={9}
            fill={LABEL}
            textAnchor="end"
          >
            {formatCompact((t / (ticks.length - 1)) * max)}
          </SvgText>
        );
      })}
    </>
  );
}

function EmptyOverlay({ message }: { message: string }) {
  return (
    <View className="absolute inset-0 items-center justify-center">
      <Text className="text-[#555] text-xs font-semibold">{message}</Text>
    </View>
  );
}

export interface VolumePoint {
  label: string;
  value: number;
}

/** Bar chart of total volume (kg) per session, oldest → newest. */
export function VolumeBarChart({ data }: { data: VolumePoint[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(280, screenWidth - 64); // card + screen padding
  const plotW = width - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, 1, 2];
  const slot = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(28, slot * 0.55);
  const labelEvery = Math.max(1, Math.ceil(data.length / 5));

  return (
    <View>
      <Svg width={width} height={CHART_H}>
        <Gridlines width={width} ticks={ticks} />
        <YAxisLabels ticks={ticks} max={max} />
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * plotH);
          const x = PAD_L + slot * i + (slot - barW) / 2;
          return (
            <Rect
              key={i}
              x={x}
              y={PAD_T + plotH - h}
              width={barW}
              height={h}
              rx={4}
              fill={colors.cta}
            />
          );
        })}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <SvgText
              key={`l${i}`}
              x={PAD_L + slot * i + slot / 2}
              y={CHART_H - 6}
              fontSize={9}
              fill={LABEL}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          ) : null
        )}
      </Svg>
      {data.length === 0 && <EmptyOverlay message="No sessions yet — finish a workout to see volume." />}
    </View>
  );
}

export interface OverloadSeries {
  name: string;
  color: string;
  /** Aligned to `labels`; null when the exercise wasn't trained that session. */
  points: (number | null)[];
}

/** Line chart of estimated 1RM per exercise over recent sessions. */
export function OverloadLineChart({
  series,
  labels,
}: {
  series: OverloadSeries[];
  labels: string[];
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(280, screenWidth - 64);
  const plotW = width - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  const allValues = series.flatMap((s) => s.points.filter((p): p is number => p !== null));
  const hasData = allValues.length > 0;
  const rawMin = hasData ? Math.min(...allValues) : 0;
  const rawMax = hasData ? Math.max(...allValues) : 1;
  const pad = Math.max(1, (rawMax - rawMin) * 0.15);
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;

  const ticks = [0, 1, 2];
  const xFor = (i: number) =>
    labels.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (labels.length - 1)) * plotW;
  const yFor = (v: number) => PAD_T + plotH - ((v - min) / (max - min)) * plotH;
  const labelEvery = Math.max(1, Math.ceil(labels.length / 5));

  return (
    <View>
      {series.length > 0 && (
        <View className="flex-row flex-wrap mb-2">
          {series.map((s) => (
            <View key={s.name} className="flex-row items-center mr-4 mb-1">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
              <Text className="text-[#A0A0A0] text-xs ml-1.5" numberOfLines={1}>
                {s.name}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Svg width={width} height={CHART_H}>
        <Gridlines width={width} ticks={ticks} />
        <YAxisLabels ticks={ticks} max={max} />
        {series.map((s) => {
          const pts = s.points
            .map((v, i) => (v === null ? null : `${xFor(i)},${yFor(v)}`))
            .filter((p): p is string => p !== null);
          return (
            <React.Fragment key={s.name}>
              {pts.length > 1 && (
                <Polyline
                  points={pts.join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.points.map((v, i) =>
                v === null ? null : (
                  <Circle key={i} cx={xFor(i)} cy={yFor(v)} r={3} fill={s.color} />
                )
              )}
            </React.Fragment>
          );
        })}
        {labels.map((label, i) =>
          i % labelEvery === 0 ? (
            <SvgText
              key={`l${i}`}
              x={xFor(i)}
              y={CHART_H - 6}
              fontSize={9}
              fill={LABEL}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ) : null
        )}
      </Svg>
      {!hasData && <EmptyOverlay message="No sets logged yet — complete sets to track strength." />}
    </View>
  );
}
