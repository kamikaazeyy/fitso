import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useLoadableData } from '@/hooks/useLoadableData';
import { LoadableContainer } from '@/components/LoadableContainer';

interface Stats {
  weight: string;
  height: string;
  age: string;
  goal: string;
}

interface ProfileData {
  name: string;
  email: string;
  avatarIcon: string;
  stats: Stats;
}

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const DUMMY_PROFILE: ProfileData = {
  name: 'Alex Fitso',
  email: 'alex@fitso.app',
  avatarIcon: 'person',
  stats: {
    weight: '78 kg',
    height: '182 cm',
    age: '28',
    goal: 'Muscle gain',
  },
};

export default function ProfileScreen() {
  const { data, status } = useLoadableData<ProfileData>(
    () => Promise.resolve(DUMMY_PROFILE),
    [],
    { loadingDelay: 500 }
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <ScrollView
        className="px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-4 pb-5">
          <Text className="text-white text-3xl font-extrabold tracking-tight">
            Account
          </Text>
          <Text className="text-[#A0A0A0] text-sm mt-1">
            Your profile and preferences.
          </Text>
        </View>

        {/* Profile card */}
        <LoadableContainer
          status={status}
          loadingMessage="Loading profile..."
          emptyIcon="person-outline"
          emptyTitle="No profile found"
          emptySubtitle="Set up your profile to see stats and settings."
        >
          {data && (
            <View className="bg-[#121212] rounded-[24px] p-5 mb-5">
              <View className="flex-row items-center">
                <View className="w-16 h-16 rounded-full bg-[#E63946] items-center justify-center">
                  <Ionicons name={data.avatarIcon as IoniconsName} size={32} color="#FFFFFF" />
                </View>
                <View className="ml-4">
                  <Text className="text-white text-xl font-bold">{data.name}</Text>
                  <Text className="text-[#A0A0A0] text-sm">{data.email}</Text>
                </View>
              </View>

              <View className="mt-5 flex-row justify-around">
                <View className="items-center">
                  <Text className="text-white text-base font-bold">{data.stats.weight}</Text>
                  <Text className="text-[#A0A0A0] text-sm">Weight</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white text-base font-bold">{data.stats.height}</Text>
                  <Text className="text-[#A0A0A0] text-sm">Height</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white text-base font-bold">{data.stats.age}</Text>
                  <Text className="text-[#A0A0A0] text-sm">Age</Text>
                </View>
              </View>
            </View>
          )}
        </LoadableContainer>

        {/* Settings */}
        <Text className="text-white text-lg font-extrabold mb-3">Settings</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
          onPress={() => Alert.alert('Coming soon', 'Goals settings are under development.')}
        >
          <View className="flex-row items-center">
            <Ionicons name="flag-outline" size={20} color="#E63946" />
            <Text className="text-white font-semibold ml-3">Goals</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
          onPress={() => Alert.alert('Coming soon', 'Notifications settings are under development.')}
        >
          <View className="flex-row items-center">
            <Ionicons name="notifications-outline" size={20} color="#E63946" />
            <Text className="text-white font-semibold ml-3">Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
          onPress={() => Alert.alert('Coming soon', 'Units settings are under development.')}
        >
          <View className="flex-row items-center">
            <Ionicons name="options-outline" size={20} color="#E63946" />
            <Text className="text-white font-semibold ml-3">Units</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
          onPress={() => Alert.alert('Coming soon', 'Help center is under development.')}
        >
          <View className="flex-row items-center">
            <Ionicons name="help-circle-outline" size={20} color="#E63946" />
            <Text className="text-white font-semibold ml-3">Help</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
          onPress={() =>
            Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive' },
            ])
          }
        >
          <View className="flex-row items-center">
            <Ionicons name="log-out-outline" size={20} color="#E63946" />
            <Text className="text-white font-semibold ml-3">Log Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
