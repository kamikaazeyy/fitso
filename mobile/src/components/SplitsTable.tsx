import React from 'react';
import { View, Text } from 'react-native';
import type { CardioSplit } from '@/src/types/workout';
import { formatPace } from '@/src/utils/geo';

interface SplitsTableProps {
  splits: CardioSplit[];
  avgPaceSecondsPerKm?: number | null;
}

export function SplitsTable({ splits, avgPaceSecondsPerKm }: SplitsTableProps) {
  if (!splits || splits.length === 0) {
    return (
      <View className="bg-[#1C1C1E] rounded-[20px] p-4 items-center justify-center">
        <Text className="text-[#8E8E93] text-sm">No split data recorded yet (minimum 1 km).</Text>
      </View>
    );
  }

  const fastestSplitPace = Math.min(...splits.map((s) => s.paceSecondsPerKm));

  return (
    <View className="bg-[#1C1C1E] rounded-[24px] p-5">
      <View className="flex-row items-center justify-between pb-3 border-b border-[#2C2C2E] mb-3">
        <Text className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider">Split</Text>
        <Text className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider">Elev</Text>
        <Text className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider">Pace</Text>
      </View>

      {splits.map((split) => {
        const isFastest = split.paceSecondsPerKm === fastestSplitPace;
        const paceStr = formatPace(split.paceSecondsPerKm);

        return (
          <View
            key={split.splitIndex}
            className="flex-row items-center justify-between py-2.5 border-b border-[#2C2C2E]/50 last:border-b-0"
          >
            <View className="flex-row items-center w-16">
              <View
                className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                  isFastest ? 'bg-[#E63946]' : 'bg-[#2C2C2E]'
                }`}
              >
                <Text className="text-white text-xs font-bold">{split.splitIndex}</Text>
              </View>
              <Text className="text-white font-medium text-sm">km</Text>
            </View>

            <Text className="text-[#A0A0A0] text-xs">
              {split.elevationGainMeters > 0 ? `+${split.elevationGainMeters}m` : '0m'}
            </Text>

            <View className="flex-row items-center">
              <Text
                className={`text-sm font-bold ${
                  isFastest ? 'text-[#E63946]' : 'text-white'
                }`}
              >
                {paceStr}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
