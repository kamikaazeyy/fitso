import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react-native';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WORKOUT_SETS_TABLE, WORKOUTS_TABLE } from '@/src/db/AppSchema';
import { SET_TYPE_CYCLE, SET_TYPE_LABELS, type SetType, type CardioSplit } from '@/src/types/workout';
import { setVolume } from '@/src/utils/personalRecord';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { displayWeight, formatWeight, parseWeightInput, type WeightUnit } from '@/src/utils/units';
import { uuid } from '@/src/utils/id';
import { LoadableContainer } from '@/components/LoadableContainer';
import { colors } from '@/constants/theme';
import { ActivityMap, SplitsTable } from '@/src/components';
import { extractRows, extractFirstRow } from '@/src/db/queryHelper';
import {
  decodeCoordinates,
  formatPace,
  formatSpeed,
  formatDistance,
  generateGpxString,
} from '@/src/utils/geo';

interface SetDraft {
  id: string;
  exerciseName: string;
  orderIndex: number;
  setNumber: number;
  setType: SetType;
  weight: string;
  reps: string;
  rpe: string;
  isCompleted: boolean;
  isNew: boolean;
}

interface ExerciseGroup {
  key: string;
  name: string;
  orderIndex: number;
  wgerId: number | null;
  attachment: string | null;
  sets: SetDraft[];
}

interface WorkoutRow {
  id: string;
  workout_type: string | null;
  title: string;
  started_at: string;
  finished_at: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  avg_pace_seconds_per_km: number | null;
  max_speed_mps: number | null;
  elevation_gain_meters: number | null;
  calories_burned: number | null;
  route_coordinates: string | null;
  splits: string | null;
}

const SET_TYPE_COLORS: Record<SetType, string> = {
  NORMAL: '#FFFFFF',
  WARMUP: '#FFD600',
  DROP: '#00E5FF',
  FAILURE: '#E63946',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

function groupSets(rows: Record<string, unknown>[], unit: WeightUnit): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup>();
  for (const row of rows) {
    const orderIndex = (row.order_index as number) ?? 0;
    const name = row.exercise_name as string;
    const key = `${orderIndex}::${name}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name,
        orderIndex,
        wgerId: (row.wger_id as number | null) ?? null,
        attachment: (row.attachment as string | null) ?? null,
        sets: [],
      };
      groups.set(key, group);
    }
    group.sets.push({
      id: row.id as string,
      exerciseName: name,
      orderIndex,
      setNumber: (row.set_number as number) ?? group.sets.length + 1,
      setType: ((row.set_type as SetType) ?? 'NORMAL'),
      weight:
        row.weight !== null && row.weight !== undefined
          ? String(displayWeight(Number(row.weight), unit) ?? row.weight)
          : '',
      reps: row.reps !== null && row.reps !== undefined ? String(row.reps) : '',
      rpe: row.rpe !== null && row.rpe !== undefined ? String(row.rpe) : '',
      isCompleted: row.is_completed === 1,
      isNew: false,
    });
  }
  return [...groups.values()].sort((a, b) => a.orderIndex - b.orderIndex);
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const db = usePowerSync();
  const queryClient = useQueryClient();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();

  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  // All-time best set volume per exercise across OTHER workouts — PR baseline.
  const [priorBests, setPriorBests] = useState<Map<string, number>>(new Map());
  const [deletedSetIds, setDeletedSetIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unit = useSettingsStore((s) => s.weightUnit);

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const workoutResult = await db.execute(
          `SELECT id, workout_type, title, started_at, finished_at, duration_seconds,
                  distance_meters, avg_pace_seconds_per_km, max_speed_mps,
                  elevation_gain_meters, calories_burned, route_coordinates, splits
           FROM ${WORKOUTS_TABLE} WHERE id = ?`,
          [workoutId]
        );
        const row = extractFirstRow<WorkoutRow>(workoutResult);
        if (!row) {
          if (!cancelled) setError('Workout not found');
          return;
        }

        const setsResult = await db.execute(
          `SELECT * FROM ${WORKOUT_SETS_TABLE} WHERE workout_id = ?
           ORDER BY order_index ASC, set_number ASC`,
          [workoutId]
        );

        // PR baseline: best volume (weight × reps) of completed NORMAL sets in workouts that
        // finished before this one started — a set only counts as a PR if it
        // beat history at the time it was logged.
        const priorResult = await db.execute(
          `SELECT ws.exercise_name, ws.weight, ws.reps
           FROM ${WORKOUT_SETS_TABLE} ws
           JOIN ${WORKOUTS_TABLE} w ON w.id = ws.workout_id
           WHERE ws.workout_id != ? AND ws.is_completed = 1
             AND (ws.set_type IS NULL OR ws.set_type = 'NORMAL')
             AND w.finished_at < ?`,
          [workoutId, row.started_at]
        );
        const bests = new Map<string, number>();
        for (const prior of extractRows<{
          exercise_name: string;
          weight: number | null;
          reps: number | null;
        }>(priorResult)) {
          const volume = setVolume(prior.weight, prior.reps);
          if (volume !== null && volume > (bests.get(prior.exercise_name) ?? 0)) {
            bests.set(prior.exercise_name, volume);
          }
        }

        if (!cancelled) {
          setWorkout(row);
          setTitle(row.title);
          setGroups(groupSets(extractRows<Record<string, unknown>>(setsResult), unit));
          setPriorBests(bests);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [workoutId, db, unit]);

  // A set is a PR when its volume beats every completed NORMAL set that came
  // before it — history (priorBests) plus earlier sets in this workout — the
  // same definition the in-workout badge uses.
  const prSetIds = useMemo(() => {
    const flagged = new Set<string>();
    const running = new Map<string, number>();
    for (const group of groups) {
      for (const set of group.sets) {
        if (!set.isCompleted || set.setType !== 'NORMAL') continue;
        const volume = setVolume(
          parseWeightInput(set.weight, unit),
          parseInt(set.reps, 10) || null
        );
        if (volume === null) continue;
        const best = Math.max(priorBests.get(group.name) ?? 0, running.get(group.name) ?? 0);
        if (volume > best) flagged.add(set.id);
        running.set(group.name, Math.max(running.get(group.name) ?? 0, volume));
      }
    }
    return flagged;
  }, [groups, unit, priorBests]);

  const totalVolume = useMemo(
    () =>
      groups.reduce(
        (sum, group) =>
          sum +
          group.sets.reduce(
            (s, set) =>
              set.isCompleted
                ? s + (parseWeightInput(set.weight, unit) ?? 0) * (parseInt(set.reps, 10) || 0)
                : s,
            0
          ),
        0
      ),
    [groups, unit]
  );

  const patchSet = (groupKey: string, setId: string, patch: Partial<SetDraft>) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey
          ? { ...group, sets: group.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          : group
      )
    );
  };

  const addSet = (groupKey: string) => {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;
        return {
          ...group,
          sets: [
            ...group.sets,
            {
              id: uuid(),
              exerciseName: group.name,
              orderIndex: group.orderIndex,
              setNumber: group.sets.length + 1,
              setType: 'NORMAL' as SetType,
              weight: '',
              reps: '',
              rpe: '',
              isCompleted: false,
              isNew: true,
            },
          ],
        };
      })
    );
  };

  const removeSet = (groupKey: string, setId: string, isNew: boolean) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              sets: group.sets
                .filter((s) => s.id !== setId)
                .map((s, i) => ({ ...s, setNumber: i + 1 })),
            }
          : group
      )
    );
    if (!isNew) setDeletedSetIds((prev) => new Set(prev).add(setId));
  };

  const handleSave = async () => {
    if (!workoutId || !workout) return;
    setSaving(true);
    try {
      await db.writeTransaction(async (tx) => {
        await tx.execute(`UPDATE ${WORKOUTS_TABLE} SET title = ? WHERE id = ?`, [
          title.trim() || workout.title,
          workoutId,
        ]);

        for (const id of deletedSetIds) {
          await tx.execute(`DELETE FROM ${WORKOUT_SETS_TABLE} WHERE id = ?`, [id]);
        }

        const now = new Date().toISOString();
        for (const group of groups) {
          for (const set of group.sets) {
            const weight = parseWeightInput(set.weight, unit);
            const reps = set.reps.trim() === '' ? null : parseInt(set.reps, 10);
            const rpe = set.rpe.trim() === '' ? null : parseFloat(set.rpe);
            if (set.isNew) {
              await tx.execute(
                `INSERT INTO ${WORKOUT_SETS_TABLE}
                   (id, workout_id, exercise_name, wger_id, order_index, set_number, set_type, weight, reps, rpe, is_completed, attachment, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  set.id,
                  workoutId,
                  group.name,
                  group.wgerId,
                  group.orderIndex,
                  set.setNumber,
                  set.setType,
                  weight,
                  reps,
                  rpe,
                  set.isCompleted ? 1 : 0,
                  group.attachment,
                  now,
                ]
              );
            } else {
              await tx.execute(
                `UPDATE ${WORKOUT_SETS_TABLE}
                 SET set_number = ?, set_type = ?, weight = ?, reps = ?, rpe = ?, is_completed = ?
                 WHERE id = ?`,
                [set.setNumber, set.setType, weight, reps, rpe, set.isCompleted ? 1 : 0, set.id]
              );
            }
          }
        }
      });
      setDeletedSetIds(new Set());
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      Alert.alert('Failed to save', err instanceof Error ? err.message : 'Could not save workout');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkout = () => {
    Alert.alert('Delete workout?', 'This removes the session and all its sets permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.writeTransaction(async (tx) => {
              await tx.execute(`DELETE FROM ${WORKOUT_SETS_TABLE} WHERE workout_id = ?`, [workoutId]);
              await tx.execute(`DELETE FROM ${WORKOUTS_TABLE} WHERE id = ?`, [workoutId]);
            });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            router.back();
          } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Could not delete workout');
          }
        },
      },
    ]);
  };

  const isCardio = workout?.workout_type && workout.workout_type !== 'STRENGTH';

  const coordinates = useMemo(() => {
    if (!workout?.route_coordinates) return [];
    return decodeCoordinates(workout.route_coordinates);
  }, [workout?.route_coordinates]);

  const splits = useMemo<CardioSplit[]>(() => {
    if (!workout?.splits) return [];
    try {
      return typeof workout.splits === 'string' ? JSON.parse(workout.splits) : workout.splits;
    } catch {
      return [];
    }
  }, [workout?.splits]);

  const handleExportGpx = async () => {
    if (!workout || coordinates.length === 0) {
      Alert.alert('No GPS Route', 'This activity does not have GPS track data to export.');
      return;
    }
    try {
      const gpx = generateGpxString(
        workout.title,
        workout.started_at,
        coordinates.map((c, i) => ({
          latitude: c.latitude,
          longitude: c.longitude,
          timestamp: new Date(workout.started_at).getTime() + i * 1000,
        }))
      );
      await Share.share({
        title: `${workout.title}.gpx`,
        message: gpx,
      });
    } catch (err) {
      Alert.alert('Export Failed', 'Could not share GPX track.');
    }
  };

  const status = loading ? 'loading' : error || !workout ? 'empty' : 'data';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} className="flex-1 bg-black">
      <View style={{ backgroundColor: '#000000' }} className="flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-1">
            {editing ? (
              <TextInput
                value={title}
                onChangeText={setTitle}
                className="text-white text-lg font-extrabold tracking-tight bg-[#1C1C1E] rounded-lg px-2 py-1"
                autoCapitalize="words"
              />
            ) : (
              <Text className="text-white text-lg font-extrabold tracking-tight" numberOfLines={1}>
                {workout?.title ?? 'Workout'}
              </Text>
            )}
            {workout && (
              <Text className="text-[#A0A0A0] text-xs mt-0.5">
                {formatDate(workout.finished_at)} · {formatDuration(workout.duration_seconds ?? 0)}
                {!isCardio && ` · ${formatWeight(totalVolume, unit)}`}
              </Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleDeleteWorkout}
            activeOpacity={0.7}
            accessibilityLabel="Delete workout"
            className="mr-3 p-2.5 rounded-full bg-[#1C1C1E]"
          >
            <Ionicons name="trash-outline" size={18} color="#E63946" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={saving}
            onPress={() => (editing ? handleSave() : setEditing(true))}
            className="rounded-xl px-5 py-2.5 bg-[#E63946]"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white font-bold text-sm">{editing ? 'Save' : 'Edit'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#000000' }}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LoadableContainer
          status={status}
          loadingMessage="Loading workout..."
          emptyIcon="barbell-outline"
          emptyTitle="Workout not found"
          emptySubtitle={error ?? 'It may have been deleted.'}
          error={error}
        >
          {isCardio ? (
            <View>
              {/* Interactive Route Map */}
              {coordinates.length > 0 ? (
                <View className="h-72 rounded-[24px] overflow-hidden mb-4 border border-[#2C2C2E]">
                  <ActivityMap coordinates={coordinates} interactive={true} isLive={false} />
                </View>
              ) : (
                <View className="h-40 bg-[#121212] rounded-[24px] items-center justify-center mb-4 border border-[#2C2C2E]">
                  <Ionicons name="map-outline" size={32} color="#8E8E93" />
                  <Text className="text-[#8E8E93] text-sm mt-2">No GPS route captured for this workout</Text>
                </View>
              )}

              {/* Primary Stats Grid */}
              <View className="bg-[#121212] rounded-[24px] p-5 mb-4 border border-[#1C1C1E]">
                <View className="flex-row items-center justify-between pb-4 border-b border-[#1C1C1E]">
                  <View className="flex-1">
                    <Text className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider">Distance</Text>
                    <Text className="text-white text-3xl font-extrabold mt-1">
                      {((workout?.distance_meters ?? 0) / 1000).toFixed(2)}{' '}
                      <Text className="text-base text-[#8E8E93] font-semibold">km</Text>
                    </Text>
                  </View>
                  <View className="flex-1 items-end">
                    <Text className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider">Avg Pace</Text>
                    <Text className="text-white text-3xl font-extrabold mt-1">
                      {formatPace(workout?.avg_pace_seconds_per_km)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between pt-4">
                  <View className="flex-1">
                    <Text className="text-[#8E8E93] text-xs font-semibold uppercase">Time</Text>
                    <Text className="text-white text-lg font-bold mt-0.5">
                      {formatDuration(workout?.duration_seconds ?? 0)}
                    </Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className="text-[#8E8E93] text-xs font-semibold uppercase">Elevation</Text>
                    <Text className="text-white text-lg font-bold mt-0.5">
                      +{Math.round(workout?.elevation_gain_meters ?? 0)} m
                    </Text>
                  </View>
                  <View className="flex-1 items-end">
                    <Text className="text-[#8E8E93] text-xs font-semibold uppercase">Calories</Text>
                    <Text className="text-white text-lg font-bold mt-0.5">
                      {workout?.calories_burned ?? 0} kcal
                    </Text>
                  </View>
                </View>
              </View>

              {/* 1km Splits Table */}
              {splits.length > 0 && (
                <View className="mb-4">
                  <Text className="text-white text-lg font-bold mb-2.5">Kilometer Splits</Text>
                  <SplitsTable splits={splits} avgPaceSecondsPerKm={workout?.avg_pace_seconds_per_km} />
                </View>
              )}

              {/* Export GPX Button */}
              {coordinates.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-[20px] py-3.5 flex-row items-center justify-center mb-4"
                  onPress={handleExportGpx}
                >
                  <Ionicons name="share-outline" size={18} color="#E63946" />
                  <Text className="text-white font-bold text-sm ml-2">Export GPX Track</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            groups.map((group) => (
            <View key={group.key} className="bg-[#121212] rounded-[20px] p-4 mb-3">
              <Text className="text-white text-base font-bold mb-3">{group.name}</Text>

              <View className="flex-row items-center mb-2 px-1">
                <Text className="text-[#A0A0A0] text-[10px] font-semibold w-10 uppercase">Set</Text>
                <Text className="text-[#A0A0A0] text-[10px] font-semibold w-14 text-center uppercase">
                  {unit}
                </Text>
                <Text className="text-[#A0A0A0] text-[10px] font-semibold w-14 text-center uppercase">Reps</Text>
                <Text className="text-[#A0A0A0] text-[10px] font-semibold w-11 text-center uppercase">RPE</Text>
                <View className="flex-1 items-end">
                  <Ionicons name="checkmark" size={12} color="#A0A0A0" />
                </View>
              </View>

              {group.sets.map((set) => {
                // Weight draft is in the display unit — parse back to kg so it
                // compares correctly against the kg-based session bests.
                const isPR = prSetIds.has(set.id);
                const label = SET_TYPE_LABELS[set.setType];

                return (
                  <View key={set.id} className="flex-row items-center mb-2">
                    <TouchableOpacity
                      disabled={!editing}
                      onPress={() =>
                        patchSet(group.key, set.id, {
                          setType:
                            SET_TYPE_CYCLE[
                              (SET_TYPE_CYCLE.indexOf(set.setType) + 1) % SET_TYPE_CYCLE.length
                            ],
                        })
                      }
                      activeOpacity={0.7}
                      className="w-10 h-9 rounded-lg bg-[#1C1C1E] items-center justify-center mr-2"
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: SET_TYPE_COLORS[set.setType] }}
                      >
                        {label || set.setNumber}
                      </Text>
                    </TouchableOpacity>

                    {editing ? (
                      <>
                        <TextInput
                          value={set.weight}
                          onChangeText={(val) => patchSet(group.key, set.id, { weight: val })}
                          keyboardType="decimal-pad"
                          className="w-14 h-9 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold mr-2"
                        />
                        <TextInput
                          value={set.reps}
                          onChangeText={(val) => patchSet(group.key, set.id, { reps: val })}
                          keyboardType="number-pad"
                          className="w-14 h-9 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold mr-2"
                        />
                        <TextInput
                          value={set.rpe}
                          onChangeText={(val) => patchSet(group.key, set.id, { rpe: val })}
                          keyboardType="decimal-pad"
                          placeholder="—"
                          placeholderTextColor="#555"
                          className="w-11 h-9 bg-[#1C1C1E] rounded-lg text-white text-center text-xs font-semibold mr-2"
                        />
                      </>
                    ) : (
                      <>
                        <Text className="text-white text-sm font-semibold w-14 text-center">
                          {set.weight || '—'}
                        </Text>
                        <Text className="text-white text-sm font-semibold w-14 text-center">
                          {set.reps || '—'}
                        </Text>
                        <Text className="text-[#A0A0A0] text-xs w-11 text-center">
                          {set.rpe || '—'}
                        </Text>
                      </>
                    )}

                    <View className="flex-1 flex-row items-center justify-end">
                      {isPR && (
                        <View className="px-1.5 rounded bg-[#E63946] mr-2">
                          <Text className="text-[9px] font-extrabold text-white">PR</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        disabled={!editing}
                        onPress={() =>
                          patchSet(group.key, set.id, { isCompleted: !set.isCompleted })
                        }
                        activeOpacity={0.7}
                        className={`w-9 h-9 rounded-lg items-center justify-center ${
                          set.isCompleted ? 'bg-[#4ADE80]' : 'bg-[#1C1C1E]'
                        }`}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={set.isCompleted ? '#000000' : '#555'}
                        />
                      </TouchableOpacity>
                      {editing && (
                        <TouchableOpacity
                          onPress={() => removeSet(group.key, set.id, set.isNew)}
                          activeOpacity={0.7}
                          className="w-9 h-9 items-center justify-center"
                          accessibilityLabel={`delete-set-${set.setNumber}`}
                        >
                          <Ionicons name="close" size={16} color="#E63946" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              {editing && (
                <TouchableOpacity
                  onPress={() => addSet(group.key)}
                  activeOpacity={0.7}
                  className="flex-row items-center justify-center mt-1 py-2.5 rounded-xl bg-[#1C1C1E]"
                >
                  <Ionicons name="add" size={16} color={colors.cta} />
                  <Text className="text-[#E63946] font-semibold text-xs ml-1.5">Add Set</Text>
                </TouchableOpacity>
              )}
            </View>
          )))}
        </LoadableContainer>
      </ScrollView>
    </SafeAreaView>
  );
}
