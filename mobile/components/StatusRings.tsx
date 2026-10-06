import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const TRACK = '#2C2C2E';
const SIZE = 84;
const STROKE = 7;

export interface StatusRing {
  /** 0..1 fill fraction. */
  fill: number;
  /** Center label, e.g. "44%". */
  value: string;
  label: string;
  sublabel: string;
  color: string;
}

function Ring({ fill, value, label, sublabel, color }: StatusRing) {
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

export function StatusRings({ rings }: { rings: StatusRing[] }) {
  return (
    <View className="flex-row justify-between">
      {rings.map((ring) => (
        <Ring key={ring.label} {...ring} />
      ))}
    </View>
  );
}
