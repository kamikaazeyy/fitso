import { View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLoadableData } from '@/hooks/useLoadableData';
import { LoadableContainer } from '@/components/LoadableContainer';
import { ScreenScroll } from '@/components/ScreenScroll';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsRow } from '@/components/SettingsRow';
import { showComingSoon } from '@/lib/alerts';
import type { ComponentProps } from 'react';

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
    <ScreenScroll className="px-4">
      <ScreenHeader
        title="Account"
        subtitle="Your profile and preferences."
        className="pt-4 pb-5"
      />

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

      <SettingsRow
        icon="flag-outline"
        label="Goals"
        onPress={() => showComingSoon('Goals settings are under development.')}
      />
      <SettingsRow
        icon="notifications-outline"
        label="Notifications"
        onPress={() => showComingSoon('Notifications settings are under development.')}
      />
      <SettingsRow
        icon="options-outline"
        label="Units"
        onPress={() => showComingSoon('Units settings are under development.')}
      />
      <SettingsRow
        icon="help-circle-outline"
        label="Help"
        onPress={() => showComingSoon('Help center is under development.')}
      />
      <SettingsRow
        icon="log-out-outline"
        label="Log Out"
        onPress={() =>
          Alert.alert('Log Out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive' },
          ])
        }
      />
    </ScreenScroll>
  );
}
