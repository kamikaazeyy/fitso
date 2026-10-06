import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MUSCLE_GROUP_COLORS, type MuscleLoadSlice } from '@/src/utils/muscles';

const SIZE = 150;
const STROKE = 22;
const TRACK = '#1C1C1E';

/**
 * Bevel-style muscular load donut — each muscle group is an arc whose length
 * is its share of training volume. Legend on the right shows group + %.
 */
export function MuscularLoadChart({ slices }: { slices: MuscleLoadSlice[] }) {
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 0.015 : 0; // share fraction gap between arcs

  let acc = 0;
  const arcs = slices.map((s) => {
    const start = acc;
    acc += s.share;
    return { ...s, start };
  });

  return (
    <View className="flex-row items-center">
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
          {arcs.map((a) => (
            <Circle
              key={a.group}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={MUSCLE_GROUP_COLORS[a.group]}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${Math.max(0, (a.share - gap) * c)} ${c}`}
              strokeDashoffset={-(a.start + gap / 2) * c}
              rotation={-90}
              originX={SIZE / 2}
              originY={SIZE / 2}
            />
          ))}
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-[#8E8E93] text-[10px] font-bold tracking-widest">LOAD</Text>
        </View>
      </View>

      <View className="flex-1 ml-5">
        {slices.length === 0 ? (
          <Text className="text-[#A0A0A0] text-sm">No sets in range.</Text>
        ) : (
          slices.map((s) => (
            <View key={s.group} className="flex-row items-center mb-2">
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: MUSCLE_GROUP_COLORS[s.group],
                }}
              />
              <Text className="text-[#A0A0A0] text-xs font-semibold ml-2 flex-1" numberOfLines={1}>
                {s.group}
              </Text>
              <Text className="text-white text-xs font-extrabold">
                {Math.round(s.share * 100)}%
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
