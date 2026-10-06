import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const checkForUpdate = async () => {
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert('Up to date', 'No update is available for this build.');
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('Update downloaded', 'Restart the app to apply the update.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart now', onPress: () => Updates.reloadAsync() },
      ]);
    } catch (e) {
      Alert.alert('Update check failed', e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

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
        <View className="bg-[#121212] rounded-[24px] p-5 mb-5">
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-[#E63946] items-center justify-center">
              <Ionicons name="person" size={32} color="#FFFFFF" />
            </View>
            <View className="ml-4">
              <Text className="text-white text-xl font-bold">{user?.name ?? 'Athlete'}</Text>
              <Text className="text-[#A0A0A0] text-sm">{user?.email ?? ''}</Text>
            </View>
          </View>

          <View className="mt-5 flex-row justify-around">
            <View className="items-center">
              <Text className="text-white text-base font-bold">—</Text>
              <Text className="text-[#A0A0A0] text-sm">Weight</Text>
            </View>
            <View className="items-center">
              <Text className="text-white text-base font-bold">—</Text>
              <Text className="text-[#A0A0A0] text-sm">Height</Text>
            </View>
            <View className="items-center">
              <Text className="text-white text-base font-bold">—</Text>
              <Text className="text-[#A0A0A0] text-sm">Age</Text>
            </View>
          </View>
        </View>

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
          onPress={() => router.push('/settings')}
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

        {Updates.isEnabled && (
          <>
            <Text className="text-white text-lg font-extrabold mb-3 mt-4">App Update</Text>
            <View className="bg-[#121212] rounded-[20px] p-4 mb-2">
              <View className="flex-row justify-between mb-2">
                <Text className="text-[#A0A0A0] text-sm">Channel</Text>
                <Text className="text-white text-sm font-semibold">
                  {Updates.channel ?? '—'}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-[#A0A0A0] text-sm">Runtime version</Text>
                <Text className="text-white text-sm font-semibold">
                  {Updates.runtimeVersion
                    ? `${Updates.runtimeVersion.slice(0, 12)}…`
                    : '—'}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[#A0A0A0] text-sm">Update</Text>
                <Text className="text-white text-sm font-semibold">
                  {Updates.isEmbeddedLaunch
                    ? 'embedded bundle'
                    : (Updates.updateId?.slice(0, 8) ?? '—')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
              disabled={checking}
              onPress={checkForUpdate}
            >
              <View className="flex-row items-center">
                <Ionicons name="cloud-download-outline" size={20} color="#E63946" />
                <Text className="text-white font-semibold ml-3">
                  {checking ? 'Checking…' : 'Check for Update'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
          onPress={() =>
            Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: logout },
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
