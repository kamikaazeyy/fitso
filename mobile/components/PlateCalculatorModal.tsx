import React, { useMemo, useState } from 'react';
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { platesFor } from '@/src/utils/plateMath';
import { displayWeight, formatWeight, parseWeightInput } from '@/src/utils/units';

const BAR_OPTIONS_KG = [20, 15, 10, 7.5];

const PLATE_COLORS: Record<number, string> = {
  25: '#E63946',
  20: '#2D6CDF',
  15: '#FFD600',
  10: '#4ADE80',
  5: '#F5F5F5',
  2.5: '#B388FF',
  1.25: '#8E8E93',
};

interface PlateCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PlateCalculatorModal({ visible, onClose }: PlateCalculatorModalProps) {
  const unit = useSettingsStore((s) => s.weightUnit);
  const barWeightKg = useSettingsStore((s) => s.defaultBarWeightKg);
  const setBarWeightKg = useSettingsStore((s) => s.setDefaultBarWeightKg);

  const [targetText, setTargetText] = useState('');

  const targetKg = parseWeightInput(targetText, unit);
  const result = useMemo(
    () => (targetKg !== null ? platesFor(targetKg, barWeightKg) : null),
    [targetKg, barWeightKg]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <TouchableWithoutFeedback>
            <View className="w-full max-w-sm bg-[#121212] rounded-[24px] p-5">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-bold">Plate calculator</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color="#A0A0A0" />
                </TouchableOpacity>
              </View>

              <Text className="text-[#A0A0A0] text-xs font-semibold uppercase mb-1.5">
                Target weight ({unit})
              </Text>
              <TextInput
                value={targetText}
                onChangeText={setTargetText}
                keyboardType="decimal-pad"
                placeholder={`e.g. ${unit === 'lbs' ? '225' : '100'}`}
                placeholderTextColor="#555"
                autoFocus
                className="bg-[#1C1C1E] rounded-xl text-white text-lg font-bold px-4 py-3 mb-4"
              />

              <Text className="text-[#A0A0A0] text-xs font-semibold uppercase mb-1.5">Bar</Text>
              <View className="flex-row flex-wrap mb-4">
                {BAR_OPTIONS_KG.map((bar) => {
                  const selected = bar === barWeightKg;
                  return (
                    <TouchableOpacity
                      key={bar}
                      activeOpacity={0.7}
                      onPress={() => setBarWeightKg(bar)}
                      className={`rounded-full px-3.5 py-1.5 mr-2 mb-1 border ${
                        selected ? 'bg-[#E63946] border-[#E63946]' : 'bg-[#1C1C1E] border-[#2C2C2E]'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${selected ? 'text-white' : 'text-[#A0A0A0]'}`}
                      >
                        {displayWeight(bar, unit)} {unit}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {result && targetKg !== null && (
                <>
                  <Text className="text-[#A0A0A0] text-xs font-semibold uppercase mb-2">
                    Per side
                  </Text>
                  {result.platesPerSide.length === 0 ? (
                    <Text className="text-white text-sm mb-2">Just the bar.</Text>
                  ) : (
                    <View className="flex-row flex-wrap mb-2">
                      {result.platesPerSide.map((plate, index) => (
                        <View
                          key={index}
                          className="rounded-lg px-2.5 py-1.5 mr-1.5 mb-1.5"
                          style={{ backgroundColor: PLATE_COLORS[plate] ?? '#2C2C2E' }}
                        >
                          <Text className="text-black text-xs font-extrabold">
                            {displayWeight(plate, unit)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text className="text-[#A0A0A0] text-xs">
                    Bar {formatWeight(barWeightKg, unit)} · total {formatWeight(result.achievedKg, unit)}
                  </Text>
                  {result.remainderKg > 0.01 && (
                    <Text className="text-[#FFD600] text-xs mt-1">
                      {formatWeight(result.remainderKg * 2, unit)} short of target — closest
                      achievable shown.
                    </Text>
                  )}
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
