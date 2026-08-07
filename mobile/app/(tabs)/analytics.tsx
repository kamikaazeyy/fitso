import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CalorieMacroTracker, DUMMY_NUTRITION, NutritionData } from '@/components/CalorieMacroTracker';
import { LoadableContainer } from '@/components/LoadableContainer';
import { ScreenScroll } from '@/components/ScreenScroll';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLoadableData } from '@/hooks/useLoadableData';
import { showComingSoon } from '@/lib/alerts';

export default function NutritionScreen() {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const { data, status } = useLoadableData<NutritionData>(
    () => Promise.resolve(DUMMY_NUTRITION),
    [],
    { loadingDelay: 600 }
  );

  return (
    <ScreenScroll>
        <ScreenHeader title="Nutrition" subtitle="Track your macros and meals." />

        <LoadableContainer
          status={status}
          loadingMessage="Loading nutrition summary..."
          emptyIcon="nutrition-outline"
          emptyTitle="No nutrition data"
          emptySubtitle="Log your first meal to get started."
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
                onPress={() => showComingSoon('Nutrition editing is under development.')}
              >
                <Text className="text-[#E63946] text-xs font-semibold">Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </LoadableContainer>

        <CalorieMacroTracker data={data} status={status} />
    </ScreenScroll>
  );
}
