import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CalorieMacroTracker, DUMMY_NUTRITION, NutritionData } from '@/components/CalorieMacroTracker';
import { LoadableContainer } from '@/components/LoadableContainer';
import { useLoadableData } from '@/hooks/useLoadableData';

export default function NutritionScreen() {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const { data, status, error, retry } = useLoadableData<NutritionData>(
    () => Promise.resolve(DUMMY_NUTRITION),
    [],
    { loadingDelay: 600 }
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-4 pb-2">
          <Text className="text-white text-3xl font-extrabold tracking-tight">
            Nutrition
          </Text>
          <Text className="text-[#A0A0A0] text-sm mt-1">
            Track your macros and meals.
          </Text>
        </View>

        <LoadableContainer
          status={status}
          loadingMessage="Loading nutrition summary..."
          emptyIcon="nutrition-outline"
          emptyTitle="No nutrition data"
          emptySubtitle="Log your first meal to get started."
          error={error}
          onRetry={retry}
        >
          {status === 'data' && (
            <View className="rounded-[20px] bg-[#121212] p-4 flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Ionicons name="nutrition" size={22} color="#E63946" />
                <Text className="text-white font-semibold ml-3">
                  {data?.date || `Today, ${today}`}
                </Text>
              </View>

              <TouchableOpacity
                className="bg-[#1C1C1E] rounded-full px-3 py-1"
                activeOpacity={0.7}
                onPress={() => Alert.alert('Coming soon', 'Nutrition editing is under development.')}
              >
                <Text className="text-[#E63946] text-xs font-semibold">Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </LoadableContainer>

        <CalorieMacroTracker data={data} status={status} error={error} onRetry={retry} />
      </ScrollView>
    </SafeAreaView>
  );
}
