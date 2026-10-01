import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { CardioLocationPoint } from '@/src/types/workout';

interface ElevationChartProps {
  points: CardioLocationPoint[];
  height?: number;
}

export function ElevationChart({ points, height = 120 }: ElevationChartProps) {
  const validPoints = points.filter((p) => p.altitude != null && Number.isFinite(p.altitude));

  if (validPoints.length < 2) {
    return null;
  }

  const altitudes = validPoints.map((p) => p.altitude as number);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const altRange = Math.max(10, maxAlt - minAlt);

  const width = 320;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Build SVG path points
  const svgCoords = validPoints.map((p, idx) => {
    const x = padding + (idx / (validPoints.length - 1)) * chartWidth;
    const y =
      padding + chartHeight - (((p.altitude as number) - minAlt) / altRange) * chartHeight;
    return { x, y };
  });

  const linePath = svgCoords.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`),
    ''
  );

  const areaPath = `${linePath} L ${svgCoords[svgCoords.length - 1].x},${height} L ${svgCoords[0].x},${height} Z`;

  return (
    <View className="bg-[#1C1C1E] rounded-[24px] p-5">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white text-base font-bold">Elevation Profile</Text>
        <Text className="text-[#8E8E93] text-xs">
          Min {Math.round(minAlt)}m · Max {Math.round(maxAlt)}m
        </Text>
      </View>

      <View className="items-center justify-center">
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="eleGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#E63946" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#E63946" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#eleGradient)" />
          <Path d={linePath} fill="none" stroke="#E63946" strokeWidth={2.5} />
        </Svg>
      </View>
    </View>
  );
}
