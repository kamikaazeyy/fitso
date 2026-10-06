import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const TRACK = '#2C2C2E';
const SIZE = 84;
const STROKE = 7;

interface RingProps {
  /** 0..1 fill fraction. */
  fill: number;
  /** Center label, e.g. "44%". */
  value: string;
  label: string;
  sublabel: string;
  color: string;
}

function Ring({ fill, value, label, sublabel, color }: RingProps) {
  const clamped = Math.max(0, Math.min(1, fill));
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View className="items-center flex-1">
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke={TRACK}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - clamped)}
            strokeLinecap="round"
            rotation={-90}
            originX={SIZE / 2}
            originY={SIZE / 2}
          />
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-white text-base font-extrabold">{value}</Text>
        </View>
      </View>
      <Text className="text-white text-sm font-bold mt-2">{label}</Text>
      <Text className="text-[#8E8E93] text-[10px] mt-0.5 text-center" numberOfLines={1}>
        {sublabel}
      </Text>
    </View>
  );
}

export interface StatusRingsProps {
  /** 0..1 — week volume vs trailing weekly average. */
  load: number;
  loadValue: string;
  loadSublabel: string;
  /** 0..1 — hours since last session saturating at 48h. */
  recovery: number;
  recoveryValue: string;
  recoverySublabel: string;
  /** 0..1 — sessions this week vs weekly target. */
  consistency: number;
  consistencyValue: string;
  consistencySublabel: string;
}

export function StatusRings(props: StatusRingsProps) {
  return (
    <View className="flex-row justify-between">
      <Ring
        fill={props.load}
        value={props.loadValue}
        label="Load"
        sublabel={props.loadSublabel}
        color="#E63946"
      />
      <Ring
        fill={props.recovery}
        value={props.recoveryValue}
        label="Recovery"
        sublabel={props.recoverySublabel}
        color="#4ADE80"
      />
      <Ring
        fill={props.consistency}
        value={props.consistencyValue}
        label="Consistency"
        sublabel={props.consistencySublabel}
        color="#00E5FF"
      />
    </View>
  );
}
