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
import { usePowerSync, useQuery } from '@powersync/react-native';
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
import { CUSTOM_EXERCISES_TABLE, EXERCISE_CACHE_TABLE } from '@/src/db/AppSchema';
import {
  ensureExerciseCache,
  mapCacheRow,
  type CachedExercise,
} from '@/src/services/exerciseCache';

const PAGE_LIMIT = 50;

/** Normalised row for the picker — same shape whether it came from the wger cache or custom_exercises. */
interface PickerExercise {
  id: string;
  name: string;
  wgerId: number | null;
  category: string;
  equipment: string[];
  imageUrl: string | null;
  isCustom: boolean;
}

function fromCached(ex: CachedExercise): PickerExercise {
  return {
    id: ex.id,
    name: ex.name,
    wgerId: ex.wgerId,
    category: ex.category,
    equipment: ex.equipment,
    imageUrl: ex.imageUrl,
    isCustom: false,
  };
}

function fromWger(info: WgerExerciseInfo): PickerExercise {
  return {
    id: info.uuid,
    name: getExerciseName(info),
    wgerId: info.id,
    category: info.category?.name ?? '',
    equipment: info.equipment.map((e) => e.name),
    imageUrl: getMainImage(info) ?? null,
    isCustom: false,
  };
}

function ExerciseItem({
  exercise,
  onSelect,
  onInfo,
}: {
  exercise: PickerExercise;
  onSelect: (exercise: PickerExercise) => void;
  onInfo: (exercise: PickerExercise) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="bg-[#121212] rounded-[20px] p-4 mb-3 flex-row items-center"
      onPress={() => onSelect(exercise)}
    >
      <View className="w-16 h-16 rounded-xl bg-[#1C1C1E] items-center justify-center overflow-hidden mr-4">
        {exercise.imageUrl ? (
          <Image source={{ uri: exercise.imageUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Ionicons name="barbell" size={28} color="#E63946" />
        )}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="text-white text-base font-bold flex-1" numberOfLines={1}>
            {exercise.name}
          </Text>
          {exercise.isCustom && (
            <View className="bg-[#E63946] rounded px-1.5 py-0.5 ml-2">
              <Text className="text-white text-[9px] font-extrabold">CUSTOM</Text>
            </View>
          )}
        </View>
        {exercise.category ? (
          <Text className="text-[#E63946] text-xs font-semibold mt-0.5">{exercise.category}</Text>
        ) : null}
        {exercise.equipment.length > 0 ? (
          <Text className="text-[#A0A0A0] text-xs mt-0.5" numberOfLines={1}>
            {exercise.equipment.join(', ')}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => onInfo(exercise)}
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityLabel={`info-${exercise.name}`}
        className="p-2 mr-1"
      >
        <Ionicons name="information-circle-outline" size={20} color="#A0A0A0" />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
    </TouchableOpacity>
  );
}

export default function ExercisePickerScreen() {
  const router = useRouter();
  const db = usePowerSync();
  const { selectExercise } = useWorkout();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [apiCategories, setApiCategories] = useState<WgerCategory[]>([]);
  // True once the catalogue prefetch has finished (or been skipped as fresh).
  // Until then the API results are merged in so a partially-filled cache
  // never looks like the whole catalogue.
  const [cacheReady, setCacheReady] = useState(false);

  // API fallback — used only until the local cache has rows.
  const [apiResults, setApiResults] = useState<WgerExerciseInfo[]>([]);
  const [apiCount, setApiCount] = useState(0);
  const [apiOffset, setApiOffset] = useState(0);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Kick off the wger prefetch; watched queries fill the list as pages land.
  useEffect(() => {
    let cancelled = false;
    void ensureExerciseCache(db).then(() => {
      if (!cancelled) setCacheReady(true);
    });
    getExerciseCategories()
      .then(setApiCategories)
      .catch(() => setApiCategories([]));
    return () => {
      cancelled = true;
    };
  }, [db]);

  // Watched local queries — these re-emit as the cache fills.
  const pattern = `%${debouncedQuery}%`;
  const cacheResult = useQuery(
    `SELECT * FROM ${EXERCISE_CACHE_TABLE}
     WHERE (name LIKE ? OR aliases LIKE ?)
       AND (? IS NULL OR category = ?)
     ORDER BY name ASC
     LIMIT 100`,
    [pattern, pattern, selectedCategory, selectedCategory]
  );
  const customResult = useQuery(
    `SELECT * FROM ${CUSTOM_EXERCISES_TABLE}
     WHERE name LIKE ?
     ORDER BY name ASC`,
    [pattern]
  );
  const cacheCategoryResult = useQuery(
    `SELECT DISTINCT category FROM ${EXERCISE_CACHE_TABLE}
     WHERE category IS NOT NULL AND category != ''
     ORDER BY category ASC`
  );

  // ---- API fallback path — active until the cache prefetch resolves ----
  const loadApiPage = useCallback(
    async (pageOffset: number, categoryId: number | null) => {
      setApiLoading(true);
      setApiError(null);
      try {
        const data = await getExercises({
          limit: PAGE_LIMIT,
          offset: pageOffset,
          category: categoryId ?? undefined,
        });
        setApiResults((prev) => (pageOffset === 0 ? data.results : [...prev, ...data.results]));
        setApiCount(data.count);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Failed to load exercises');
      } finally {
        setApiLoading(false);
      }
    },
    []
  );

  // Category chips: prefer cache-derived names; the API path still needs the
  // wger category id, so keep the name → id lookup alongside.
  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of cacheCategoryResult.data) {
      const name = (row as { category: string }).category;
      if (name) names.add(name);
    }
    for (const cat of apiCategories) names.add(cat.name);
    return [...names].sort();
  }, [cacheCategoryResult.data, apiCategories]);

  const selectedCategoryId = useMemo(
    () => apiCategories.find((c) => c.name === selectedCategory)?.id ?? null,
    [apiCategories, selectedCategory]
  );

  useEffect(() => {
    if (cacheReady) return;
    setApiResults([]);
    setApiOffset(0);
    setApiCount(0);
    setApiError(null);
    void loadApiPage(0, selectedCategoryId);
  }, [selectedCategoryId, cacheReady, loadApiPage]);

  useEffect(() => {
    if (!cacheReady && apiOffset > 0 && apiOffset < apiCount) {
      void loadApiPage(apiOffset, selectedCategoryId);
    }
  }, [apiOffset, apiCount, selectedCategoryId, cacheReady, loadApiPage]);

  const visibleApiResults = useMemo(() => {
    return apiResults.filter((info) => {
      if (selectedCategory && info.category?.name !== selectedCategory) return false;
      if (!debouncedQuery) return true;
      const lower = debouncedQuery.toLowerCase();
      const name = getExerciseName(info).toLowerCase();
      const aliases = info.translations.flatMap((t) => t.aliases.map((a) => a.alias.toLowerCase()));
      const category = info.category?.name.toLowerCase() ?? '';
      return name.includes(lower) || aliases.some((a) => a.includes(lower)) || category.includes(lower);
    });
  }, [apiResults, debouncedQuery, selectedCategory]);

  // Merge: customs first, then catalogue. While the prefetch is in flight the
  // API results fill the gaps — deduped by id so nothing appears twice.
  const exercises = useMemo<PickerExercise[]>(() => {
    const custom = customResult.data.map((row) => {
      const r = row as Record<string, unknown>;
      let equipment: string[] = [];
      try {
        const parsed = JSON.parse((r.equipment as string) ?? '[]');
        equipment = Array.isArray(parsed) ? parsed : [];
      } catch {
        equipment = [];
      }
      return {
        id: r.id as string,
        name: r.name as string,
        wgerId: null,
        category: (r.category as string) ?? '',
        equipment,
        imageUrl: null,
        isCustom: true,
      };
    });

    const catalogue = new Map<string, PickerExercise>();
    for (const row of cacheResult.data) {
      const entry = fromCached(mapCacheRow(row as Record<string, unknown>));
      catalogue.set(entry.id, entry);
    }
    if (!cacheReady) {
      for (const info of visibleApiResults) {
        const entry = fromWger(info);
        if (!catalogue.has(entry.id)) catalogue.set(entry.id, entry);
      }
    }

    const merged = [...catalogue.values()].sort((a, b) => a.name.localeCompare(b.name));
    return [...custom, ...merged];
  }, [customResult.data, cacheResult.data, visibleApiResults, cacheReady]);

  const apiHasMore = !cacheReady && apiResults.length < apiCount;
  const isInitialLoading =
    !cacheReady && apiLoading && apiResults.length === 0 && cacheResult.data.length === 0;

  const handleSelect = useCallback(
    (exercise: PickerExercise) => {
      selectExercise({
        id: exercise.id,
        name: exercise.name,
        wgerId: exercise.wgerId ?? undefined,
        equipment: exercise.equipment,
      });
      router.back();
    },
    [selectExercise, router]
  );

  const handleInfo = useCallback(
    (exercise: PickerExercise) => {
      router.push(
        exercise.isCustom
          ? `/exercise-detail?customId=${exercise.id}`
          : `/exercise-detail?cachedId=${exercise.id}`
      );
    },
    [router]
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
        <TouchableOpacity
          onPress={() => router.push('/custom-exercise')}
          activeOpacity={0.7}
          className="flex-row items-center bg-[#1C1C1E] rounded-full px-3 py-2"
          accessibilityLabel="Create custom exercise"
        >
          <Ionicons name="add" size={16} color="#E63946" />
          <Text className="text-[#E63946] text-xs font-bold ml-1">Custom</Text>
        </TouchableOpacity>
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
      {categoryNames.length > 0 ? (
        <View className="px-4 mb-3">
          <FlatList
            data={categoryNames}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const selected = selectedCategory === item;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory(selected ? null : item)}
                  className={`rounded-full px-4 py-2 mr-2 border ${
                    selected
                      ? 'bg-[#E63946] border-[#E63946]'
                      : 'bg-[#121212] border-[#2C2C2E]'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#A0A0A0]'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : null}

      {/* Results */}
      <View className="flex-1 px-4">
        {isInitialLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#E63946" />
            <Text className="text-[#A0A0A0] text-sm mt-4">Loading exercises...</Text>
          </View>
        ) : apiError && !cacheReady && cacheResult.data.length === 0 ? (
          <EmptyState
            icon="warning-outline"
            title="Something went wrong"
            subtitle={apiError}
          />
        ) : exercises.length === 0 ? (
          <EmptyState
            icon="barbell-outline"
            title={debouncedQuery || selectedCategory ? 'No exercises found' : 'Loading catalogue…'}
            subtitle={
              debouncedQuery || selectedCategory
                ? 'Try a different keyword or category — or create a custom exercise.'
                : 'The exercise catalogue downloads once and works offline afterwards.'
            }
          />
        ) : (
          <FlatList
            data={exercises}
            keyExtractor={(item) => `${item.isCustom ? 'c' : 'w'}-${item.id}`}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ExerciseItem exercise={item} onSelect={handleSelect} onInfo={handleInfo} />
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
            onEndReached={() => {
              if (apiHasMore && !apiLoading) {
                setApiOffset((prev) => prev + PAGE_LIMIT);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              apiLoading && !cacheReady ? (
                <ActivityIndicator color="#E63946" className="py-4" />
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
