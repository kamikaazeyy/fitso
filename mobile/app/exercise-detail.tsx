import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CUSTOM_EXERCISES_TABLE,
  EXERCISE_CACHE_TABLE,
  WORKOUT_SETS_TABLE,
  WORKOUTS_TABLE,
} from '@/src/db/AppSchema';
import { mapCacheRow, type CachedExercise } from '@/src/services/exerciseCache';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { displayWeight } from '@/src/utils/units';
import { LoadableContainer } from '@/components/LoadableContainer';

interface RecentSet {
  id: string;
  weight: number | null;
  reps: number | null;
  finishedAt: string;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const db = usePowerSync();
  const unit = useSettingsStore((s) => s.weightUnit);
  const { cachedId, customId, name } = useLocalSearchParams<{
    cachedId?: string;
    customId?: string;
    name?: string;
  }>();

  const [exercise, setExercise] = useState<{
    name: string;
    category: string;
    equipment: string[];
    muscles: string[];
    musclesSecondary: string[];
    description: string;
    imageUrl: string | null;
    notes: string | null;
  } | null>(null);
  const [recentSets, setRecentSets] = useState<RecentSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let resolved:
          | {
              name: string;
              category: string;
              equipment: string[];
              muscles: string[];
              musclesSecondary: string[];
              description: string;
              imageUrl: string | null;
              notes: string | null;
            }
          | null = null;

        if (cachedId) {
          const result = await db.execute(
            `SELECT * FROM ${EXERCISE_CACHE_TABLE} WHERE id = ?`,
            [cachedId]
          );
          const row = result.rows?._array?.[0] as Record<string, unknown> | undefined;
          if (row) {
            const cached: CachedExercise = mapCacheRow(row);
            resolved = { ...cached, notes: null };
          }
        } else if (customId) {
          const result = await db.execute(
            `SELECT * FROM ${CUSTOM_EXERCISES_TABLE} WHERE id = ?`,
            [customId]
          );
          const row = result.rows?._array?.[0] as Record<string, unknown> | undefined;
          if (row) {
            resolved = {
              name: row.name as string,
              category: (row.category as string) ?? '',
              equipment: parseJsonArray(row.equipment as string),
              muscles: parseJsonArray(row.muscles as string),
              musclesSecondary: [],
              description: '',
              imageUrl: null,
              notes: (row.notes as string) ?? null,
            };
          }
        } else if (name) {
          // Named lookup — exercise referenced from an active session.
          const cached = await db.execute(
            `SELECT * FROM ${EXERCISE_CACHE_TABLE} WHERE name = ? LIMIT 1`,
            [name]
          );
          const row = cached.rows?._array?.[0] as Record<string, unknown> | undefined;
          if (row) {
            const mapped = mapCacheRow(row);
            resolved = { ...mapped, notes: null };
          } else {
            resolved = {
              name,
              category: '',
              equipment: [],
              muscles: [],
              musclesSecondary: [],
              description: '',
              imageUrl: null,
              notes: null,
            };
          }
        }

        if (!resolved) {
          if (!cancelled) setError('Exercise not found');
          return;
        }

        // Recent performance: latest completed sets for this exercise name.
        const setsResult = await db.execute(
          `SELECT ws.id, ws.weight, ws.reps, w.finished_at
           FROM ${WORKOUT_SETS_TABLE} ws
           INNER JOIN ${WORKOUTS_TABLE} w ON w.id = ws.workout_id
           WHERE ws.exercise_name = ? AND ws.is_completed = 1
           ORDER BY w.finished_at DESC, ws.set_number ASC
           LIMIT 8`,
          [resolved.name]
        );

        if (!cancelled) {
          setExercise(resolved);
          setRecentSets(
            ((setsResult.rows?._array ?? []) as Record<string, unknown>[]).map((row) => ({
              id: row.id as string,
              weight: (row.weight as number | null) ?? null,
              reps: (row.reps as number | null) ?? null,
              finishedAt: row.finished_at as string,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load exercise');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [cachedId, customId, name, db]);

  const status = loading ? 'loading' : error || !exercise ? 'empty' : 'data';

  const bestSet = useMemo(() => {
    let best: RecentSet | null = null;
    for (const set of recentSets) {
      const volume = (set.weight ?? 0) * (set.reps ?? 0);
      if (!best || volume > (best.weight ?? 0) * (best.reps ?? 0)) best = set;
    }
    return best;
  }, [recentSets]);

  const handleDeleteCustom = () => {
    if (!customId) return;
    Alert.alert('Delete custom exercise?', 'This removes it from your library. Logged sets keep their name.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void db
            .execute(`DELETE FROM ${CUSTOM_EXERCISES_TABLE} WHERE id = ?`, [customId])
            .then(() => router.back());
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-extrabold tracking-tight flex-1" numberOfLines={1}>
          {exercise?.name ?? 'Exercise'}
        </Text>
        {customId ? (
          <TouchableOpacity
            onPress={handleDeleteCustom}
            activeOpacity={0.7}
            className="p-2 rounded-full bg-[#1C1C1E]"
            accessibilityLabel="Delete custom exercise"
          >
            <Ionicons name="trash-outline" size={18} color="#E63946" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <LoadableContainer
          status={status}
          loadingMessage="Loading exercise..."
          emptyIcon="barbell-outline"
          emptyTitle="Exercise not found"
          emptySubtitle={error ?? 'It may not be in the catalogue yet.'}
          error={error}
        >
          {exercise && (
            <>
              {exercise.imageUrl && (
                <View className="bg-[#121212] rounded-[20px] overflow-hidden mb-4 items-center">
                  <Image
                    source={{ uri: exercise.imageUrl }}
                    className="w-full h-52"
                    resizeMode="contain"
                  />
                </View>
              )}

              <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
                {exercise.category ? (
                  <Text className="text-[#E63946] text-xs font-bold uppercase mb-2">
                    {exercise.category}
                  </Text>
                ) : null}
                {exercise.equipment.length > 0 && (
                  <Text className="text-[#A0A0A0] text-sm mb-2">
                    {exercise.equipment.join(', ')}
                  </Text>
                )}
                {exercise.muscles.length > 0 && (
                  <View className="flex-row flex-wrap mt-1">
                    {exercise.muscles.map((muscle) => (
                      <View
                        key={muscle}
                        className="bg-[#1C1C1E] rounded-full px-3 py-1 mr-1.5 mb-1.5"
                      >
                        <Text className="text-white text-xs font-semibold">{muscle}</Text>
                      </View>
                    ))}
                    {exercise.musclesSecondary.map((muscle) => (
                      <View
                        key={muscle}
                        className="bg-[#1C1C1E]/50 rounded-full px-3 py-1 mr-1.5 mb-1.5 border border-[#2C2C2E]"
                      >
                        <Text className="text-[#A0A0A0] text-xs font-semibold">{muscle}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {exercise.description ? (
                <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
                  <Text className="text-white font-bold mb-2">How to</Text>
                  <Text className="text-[#A0A0A0] text-sm leading-5">{exercise.description}</Text>
                </View>
              ) : null}

              {exercise.notes ? (
                <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
                  <Text className="text-white font-bold mb-2">Notes</Text>
                  <Text className="text-[#A0A0A0] text-sm leading-5">{exercise.notes}</Text>
                </View>
              ) : null}

              <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
                <Text className="text-white font-bold mb-3">Recent performance</Text>
                {recentSets.length === 0 ? (
                  <Text className="text-[#A0A0A0] text-sm">
                    No completed sets logged yet.
                  </Text>
                ) : (
                  <>
                    {bestSet && (
                      <Text className="text-[#E63946] text-xs font-bold mb-2">
                        Best: {displayWeight(bestSet.weight, unit)} {unit} × {bestSet.reps}
                      </Text>
                    )}
                    {recentSets.map((set) => (
                      <View
                        key={set.id}
                        className="flex-row items-center justify-between py-2 border-b border-[#1C1C1E]"
                      >
                        <Text className="text-white text-sm font-semibold">
                          {displayWeight(set.weight, unit)} {unit} × {set.reps}
                        </Text>
                        <Text className="text-[#A0A0A0] text-xs">{formatDate(set.finishedAt)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          )}
        </LoadableContainer>
      </ScrollView>
    </SafeAreaView>
  );
}
