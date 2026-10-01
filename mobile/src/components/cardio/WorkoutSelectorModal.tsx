import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

interface WorkoutSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function WorkoutSelectorModal({ visible, onClose }: WorkoutSelectorModalProps) {
  const router = useRouter();

  const handleSelect = (route: string) => {
    onClose();
    router.push(route as any);
  };

  const options = [
    {
      id: 'run',
      title: 'Outdoor Run',
      subtitle: 'GPS map, live pace, 1km splits & elevation',
      icon: 'fitness',
      color: '#E63946',
      route: '/cardio-tracker?type=run',
    },
    {
      id: 'ride',
      title: 'Cycling / Ride',
      subtitle: 'Speed (km/h), GPS route & elevation climb',
      icon: 'bicycle',
      color: '#38BDF8',
      route: '/cardio-tracker?type=ride',
    },
    {
      id: 'walk',
      title: 'Walk / Hike',
      subtitle: 'Casual walking, trail hikes & distance tracking',
      icon: 'walk',
      color: '#4ADE80',
      route: '/cardio-tracker?type=walk',
    },
    {
      id: 'strength',
      title: 'Gym / Strength Workout',
      subtitle: 'Barbell/dumbbell sets, reps, RPE & rest timer',
      icon: 'barbell',
      color: '#FACC15',
      route: '/(tabs)/journal',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.handle} />

              <Text className="text-white text-xl font-extrabold tracking-tight mb-1">
                Start Activity
              </Text>
              <Text className="text-[#8E8E93] text-xs mb-4">
                Choose what type of workout you want to record
              </Text>

              <View className="gap-y-2.5">
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    activeOpacity={0.75}
                    onPress={() => handleSelect(opt.route)}
                    className="flex-row items-center bg-[#1C1C1E] rounded-2xl p-4 border border-[#2C2C2E]"
                  >
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center mr-3.5"
                      style={{ backgroundColor: `${opt.color}20` }}
                    >
                      <Ionicons name={opt.icon as any} size={24} color={opt.color} />
                    </View>

                    <View className="flex-1 pr-2">
                      <Text className="text-white font-bold text-base">{opt.title}</Text>
                      <Text className="text-[#8E8E93] text-xs mt-0.5" numberOfLines={1}>
                        {opt.subtitle}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color="#555555" />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onClose}
                className="mt-4 py-3 items-center justify-center rounded-xl bg-[#2C2C2E]/60"
              >
                <Text className="text-[#8E8E93] font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: '#2C2C2E',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3C',
    alignSelf: 'center',
    marginBottom: 16,
  },
});
