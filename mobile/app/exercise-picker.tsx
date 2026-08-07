import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getExercises,
  getExerciseCategories,
  getExerciseName,
  getMainImage,
  type WgerExerciseInfo,
  type WgerCategory,
} from '@/api/wger';
import { useWorkout } from '@/context/WorkoutContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

const PAGE_LIMIT = 50;

function Loader() {
  return (
    <View className="items-center justify-center py-12">
      <ActivityIndicator size="large" color="#E63946" />
      <Text className="text-[#A0A0A0] text-sm mt-4">Loading exercises...</Text>
    </View>
  );
}

function ExerciseItem({
  info,
  onSelect,
}: {
  info: WgerExerciseInfo;
  onSelect: (info: WgerExerciseInfo) => void;
}) {
  const name = getExerciseName(info);
  const imageUrl = getMainImage(info);
  const category = info.category?.name ?? '';
  const equipment = info.equipment.map((e) => e.name).join(', ');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="bg-[#121212] rounded-[20px] p-4 mb-3 flex-row items-center"
      onPress={() => onSelect(info)}
    >
      <View className="w-16 h-16 rounded-xl bg-[#1C1C1E] items-center justify-center overflow-hidden mr-4">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Ionicons name="barbell" size={28} color="#E63946" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-white text-base font-bold" numberOfLines={1}>
          {name}
        </Text>
        {category ? (
          <Text className="text-[#E63946] text-xs font-semibold mt-0.5">{category}</Text>
        ) : null}
        {equipment ? (
          <Text className="text-[#A0A0A0] text-xs mt-0.5" numberOfLines={1}>
            {equipment}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
    </TouchableOpacity>
  );
}

function matchesQuery(info: WgerExerciseInfo, query: string): boolean {
  if (!query.trim()) return true;
  const lower = query.trim().toLowerCase();
  const name = getExerciseName(info).toLowerCase();
  const aliases = info.translations.flatMap((t) => t.aliases.map((a) => a.alias.toLowerCase()));
  const category = info.category?.name.toLowerCase() ?? '';
  return (
    name.includes(lower) ||
    aliases.some((a) => a.includes(lower)) ||
    category.includes(lower)
  );
}

export default function ExercisePickerScreen() {
  const router = useRouter();
  const { selectExercise } = useWorkout();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [categories, setCategories] = useState<WgerCategory[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [allResults, setAllResults] = useState<WgerExerciseInfo[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Load categories once
  const loadCategories = useCallback(async () => {
    setCategoriesError(null);
    try {
      setCategories(await getExerciseCategories());
    } catch (err) {
      console.error('Failed to load exercise categories:', err);
      setCategories([]);
      setCategoriesError(
        err instanceof Error ? err.message : 'Failed to load exercise categories'
      );
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Reset results when category or query changes, then fetch first page
  useEffect(() => {
    setAllResults([]);
    setOffset(0);
    setCount(0);
    setError(null);
    loadPage(0, selectedCategory);
  }, [selectedCategory]);

  const loadPage = useCallback(
    async (pageOffset: number, category: number | null) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getExercises({
          limit: PAGE_LIMIT,
          offset: pageOffset,
          category: category ?? undefined,
        });

        setAllResults((prev) => (pageOffset === 0 ? data.results : [...prev, ...data.results]));
        setCount(data.count);
      } catch (err) {
        console.error('Failed to load exercises:', err);
        setError(err instanceof Error ? err.message : 'Failed to load exercises');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load next page when offset changes (via onEndReached)
  useEffect(() => {
    if (offset > 0 && offset < count) {
      loadPage(offset, selectedCategory);
    }
  }, [offset, count, selectedCategory, loadPage]);

  const visibleResults = useMemo(
    () => allResults.filter((info) => matchesQuery(info, debouncedQuery)),
    [allResults, debouncedQuery]
  );

  const hasMore = allResults.length < count;

  const handleSelect = useCallback(
    (info: WgerExerciseInfo) => {
      selectExercise({ id: info.uuid, name: getExerciseName(info) });
      router.back();
    },
    [selectExercise, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-extrabold tracking-tight">Add Exercise</Text>
        </View>
      </View>

      {/* Search */}
      <View className="px-4 mb-3">
        <View className="flex-row items-center bg-[#121212] rounded-full px-4 py-3">
          <Ionicons name="search" size={18} color="#A0A0A0" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            placeholderTextColor="#A0A0A0"
            className="flex-1 text-white ml-3 text-base"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color="#A0A0A0" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Categories */}
      {categoriesError ? (
        <View className="px-4 mb-3 flex-row items-center justify-between">
          <Text className="text-[#A0A0A0] text-xs flex-1 pr-3" numberOfLines={2}>
            Categories unavailable: {categoriesError}
          </Text>
          <TouchableOpacity onPress={loadCategories} activeOpacity={0.7}>
            <Text className="text-[#E63946] text-xs font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {categories.length > 0 ? (
        <View className="px-4 mb-3">
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const selected = selectedCategory === item.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory(selected ? null : item.id)}
                  className={`rounded-full px-4 py-2 mr-2 border ${
                    selected
                      ? 'bg-[#E63946] border-[#E63946]'
                      : 'bg-[#121212] border-[#2C2C2E]'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#A0A0A0]'}`}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : null}

      {/* Results */}
      <View className="flex-1 px-4">
        {loading && allResults.length === 0 ? (
          <Loader />
        ) : error && allResults.length === 0 ? (
          <ErrorState message={error} onRetry={() => loadPage(0, selectedCategory)} />
        ) : visibleResults.length === 0 ? (
          <EmptyState
            icon="barbell-outline"
            title={
              debouncedQuery || selectedCategory ? 'No exercises found' : 'Search for an exercise'
            }
            subtitle={
              debouncedQuery || selectedCategory
                ? 'Try a different keyword or category, or load more results by scrolling.'
                : 'Type above or pick a category to find exercises from wger.de.'
            }
          />
        ) : (
          <FlatList
            data={visibleResults}
            keyExtractor={(item) => item.uuid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <ExerciseItem info={item} onSelect={handleSelect} />}
            contentContainerStyle={{ paddingBottom: 120 }}
            onEndReached={() => {
              if (!loading && hasMore) {
                setOffset((prev) => prev + PAGE_LIMIT);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading ? (
                <ActivityIndicator color="#E63946" className="py-4" />
              ) : error ? (
                <TouchableOpacity
                  onPress={() => loadPage(offset, selectedCategory)}
                  activeOpacity={0.7}
                  className="py-4 items-center"
                >
                  <Text className="text-[#A0A0A0] text-xs text-center">
                    Couldn't load more exercises: {error}
                  </Text>
                  <Text className="text-[#E63946] text-xs font-semibold mt-1">Tap to retry</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
