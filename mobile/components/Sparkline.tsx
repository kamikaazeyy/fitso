import React from 'react';
import Svg, { Circle, Polyline } from 'react-native-svg';

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}

/** Minimal trend line for a metric across sessions (oldest → newest). */
export function Sparkline({ points, width = 96, height = 34, color = '#4ADE80' }: SparklineProps) {
  if (points.length === 0) {
    return <Svg width={width} height={height} />;
  }
  if (points.length === 1) {
    return (
      <Svg width={width} height={height}>
        <Circle cx={width / 2} cy={height / 2} r={3} fill={color} />
      </Svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 4;
  const xFor = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const yFor = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const pts = points.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={xFor(points.length - 1)} cy={yFor(points[points.length - 1])} r={3} fill={color} />
    </Svg>
  );
}
