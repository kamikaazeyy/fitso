// PowerSync sync upload — applies local CRUD operations to Postgres.
// Ported from server/index.js: identical semantics, raw SQL instead of Prisma.

const TABLE_TO_PG = {
  workouts: 'Workout',
  workout_sets: 'WorkoutSet',
  routines: 'Routine',
  splits: 'Split',
  routine_exercises: 'RoutineExercise',
  custom_exercises: 'CustomExercise',
};

const COLUMN_MAP = {
  id: 'id',
  user_id: 'userId',
  routine_id: 'routineId',
  split_id: 'splitId',
  workout_id: 'workoutId',
  exercise_name: 'exerciseName',
  wger_id: 'wgerId',
  order_index: 'orderIndex',
  set_number: 'setNumber',
  set_type: 'setType',
  is_completed: 'isCompleted',
  target_sets: 'targetSets',
  target_reps: 'targetReps',
  target_reps_max: 'targetRepsMax',
  target_weight: 'targetWeight',
  rest_seconds: 'restSeconds',
  started_at: 'startedAt',
  finished_at: 'finishedAt',
  duration_seconds: 'durationSeconds',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  title: 'title',
  name: 'name',
  notes: 'notes',
  weight: 'weight',
  reps: 'reps',
  weight_left: 'weightLeft',
  weight_right: 'weightRight',
  reps_left: 'repsLeft',
  reps_right: 'repsRight',
  execution_mode: 'executionMode',
  rpe: 'rpe',
  attachment: 'attachment',
  equipment: 'equipment',
  category: 'category',
  muscles: 'muscles',
  workout_type: 'workoutType',
  distance_meters: 'distanceMeters',
  avg_pace_seconds_per_km: 'avgPaceSecondsPerKm',
  max_speed_mps: 'maxSpeedMps',
  elevation_gain_meters: 'elevationGainMeters',
  calories_burned: 'caloriesBurned',
  route_coordinates: 'routeCoordinates',
  splits: 'splits',
};

// Tables that have a direct userId column — the server overrides this field
// with the authenticated user's id to prevent cross-user writes.
const TABLES_WITH_USER_ID = new Set(['workouts', 'routines', 'custom_exercises']);

// Fields that are NOT nullable in the schema but may arrive as null from
// SQLite (the user left the field empty). Coerce to the schema default.
const NON_NULLABLE_DEFAULTS = {
  weight: 0,
  reps: 0,
  is_completed: false,
  set_type: 'NORMAL',
  execution_mode: 'BILATERAL',
  order_index: 0,
  set_number: 0,
  duration_seconds: 0,
};

// Error type for a single failed sync operation. Thrown inside the upload
// transaction so the whole batch rolls back.
class SyncOpError extends Error {
  constructor(id, table, message, statusCode = 500) {
    super(message);
    this.opId = id;
    this.opTable = table;
    this.statusCode = statusCode;
  }
}

async function cachedLookup(cache, key, fn) {
  if (!cache.has(key)) cache.set(key, await fn());
  return cache.get(key);
}

// Resolves which user owns row `id` in `table`, walking up the parent chain
// for child tables. Returns null when no owner can be determined — e.g. a
// create whose parent isn't in Postgres yet; the FK constraint rejects the
// write anyway.
async function resolveOwnerId(table, id, opData, tx, cache) {
  const userIdOf = (rows) => rows?.[0]?.userId ?? null;
  const workoutOwner = (workoutId) =>
    cachedLookup(cache, `workout:${workoutId}`, async () =>
      userIdOf(await tx`SELECT "userId" FROM "Workout" WHERE id = ${workoutId}`)
    );
  const routineOwner = (routineId) =>
    cachedLookup(cache, `routine:${routineId}`, async () =>
      userIdOf(await tx`SELECT "userId" FROM "Routine" WHERE id = ${routineId}`)
    );
  const customExerciseOwner = (customExerciseId) =>
    cachedLookup(cache, `custom_exercise:${customExerciseId}`, async () =>
      userIdOf(await tx`SELECT "userId" FROM "CustomExercise" WHERE id = ${customExerciseId}`)
    );

  switch (table) {
    case 'workouts':
      return workoutOwner(id);
    case 'routines':
      return routineOwner(id);
    case 'custom_exercises':
      return customExerciseOwner(id);
    case 'workout_sets': {
      const rows = await cachedLookup(cache, `workout_set:${id}`, () =>
        tx`SELECT "workoutId" FROM "WorkoutSet" WHERE id = ${id}`
      );
      const workoutId = rows?.[0]?.workoutId ?? opData.workoutId;
      if (!workoutId) return null;
      return workoutOwner(workoutId);
    }
    case 'splits': {
      const rows = await cachedLookup(cache, `split:${id}`, () =>
        tx`SELECT "routineId" FROM "Split" WHERE id = ${id}`
      );
      const routineId = rows?.[0]?.routineId ?? opData.routineId;
      if (!routineId) return null;
      return routineOwner(routineId);
    }
    case 'routine_exercises': {
      const rows = await cachedLookup(cache, `routine_exercise:${id}`, () =>
        tx`SELECT "splitId" FROM "RoutineExercise" WHERE id = ${id}`
      );
      const splitId = rows?.[0]?.splitId ?? opData.splitId;
      if (!splitId) return null;
      return cachedLookup(cache, `split_owner:${splitId}`, async () => {
        const ownerRows = await tx`
          SELECT r."userId" AS "userId"
          FROM "Split" s
          JOIN "Routine" r ON r.id = s."routineId"
          WHERE s.id = ${splitId}
        `;
        return ownerRows?.[0]?.userId ?? null;
      });
    }
    default:
      return null;
  }
}

function transformOpData(opData) {
  const transformed = {};
  for (const [key, value] of Object.entries(opData)) {
    const pgKey = COLUMN_MAP[key] || key;
    let transformedValue = value;

    if (transformedValue === null && key in NON_NULLABLE_DEFAULTS) {
      transformedValue = NON_NULLABLE_DEFAULTS[key];
    }

    // SQLite stores booleans as 0/1; Postgres expects true/false
    if (key === 'is_completed') {
      transformedValue = transformedValue === 1 || transformedValue === true;
    }

    // SQLite stores String[] / JSON objects as a JSON string
    if (
      (key === 'equipment' || key === 'muscles' || key === 'splits') &&
      typeof transformedValue === 'string'
    ) {
      try {
        transformedValue = JSON.parse(transformedValue);
      } catch {
        transformedValue = key === 'splits' ? null : [];
      }
    }

    // SQLite stores dates as ISO strings; postgres.js handles Date natively
    if (typeof transformedValue === 'string' && (key.endsWith('_at') || key === 'logDate')) {
      const parsed = new Date(transformedValue);
      if (!Number.isNaN(parsed.getTime())) {
        transformedValue = parsed;
      }
    }

    transformed[pgKey] = transformedValue;
  }
  return transformed;
}

// `splits` is a Json? column on Workout — postgres.js serializes JS objects
// for JSON columns automatically via sql.json, but a plain object works too
// since the column type drives the encoding.

export async function handleSyncUpload(body, userId, sql) {
  const { operations } = body || {};
  if (!Array.isArray(operations) || operations.length === 0) {
    return { status: 200, body: { applied: 0 } };
  }

  try {
    // Apply the batch atomically — all-or-nothing, client retries on failure.
    const applied = await sql.begin(async (tx) => {
      let count = 0;
      const ownerCache = new Map();

      for (const op of operations) {
        const { table, op: opType, id, data } = op;
        const pgTable = TABLE_TO_PG[table];

        if (!pgTable) {
          throw new SyncOpError(id, table, `Unknown table: ${table}`);
        }

        const opData = transformOpData(data || {});

        // Override userId with the authenticated user's id so a compromised
        // client can't write data to another user's account.
        if (TABLES_WITH_USER_ID.has(table)) {
          opData.userId = userId;
        }

        // postgres.js requires sql.json() for objects bound to json/jsonb
        // columns (Workout.splits is the only one in the schema).
        if (opData.splits !== null && typeof opData.splits === 'object') {
          opData.splits = tx.json(opData.splits);
        }

        // Verify ownership of the target row (or its parent for child
        // tables) before every write.
        const ownerId = await resolveOwnerId(table, id, opData, tx, ownerCache);
        if (ownerId && ownerId !== userId) {
          throw new SyncOpError(id, table, 'Row belongs to another user', 403);
        }

        if (opType === 'PUT') {
          const createData = { ...opData, id };
          // Routine.updatedAt is @updatedAt in Prisma — that behaviour lives
          // client-side, so replicate it here for raw SQL writes.
          if (pgTable === 'Routine' && createData.updatedAt === undefined) {
            createData.updatedAt = new Date();
          }
          if (Object.keys(opData).length === 0) {
            await tx`INSERT INTO ${tx(pgTable)} ${tx({ id })} ON CONFLICT (id) DO NOTHING`;
          } else {
            const updateCols = Object.keys(opData);
            await tx`
              INSERT INTO ${tx(pgTable)} ${tx(createData)}
              ON CONFLICT (id) DO UPDATE SET ${tx(opData, updateCols)}
            `;
          }
        } else if (opType === 'PATCH') {
          // Update only — no upsert. A PATCH carrying partial opData must not
          // create a half-populated row if the original PUT hasn't been
          // applied yet. A missing row updates nothing, which is the desired
          // end state.
          if (pgTable === 'Routine') {
            opData.updatedAt = new Date();
          }
          const cols = Object.keys(opData);
          if (cols.length > 0) {
            await tx`UPDATE ${tx(pgTable)} SET ${tx(opData, cols)} WHERE id = ${id}`;
          }
        } else if (opType === 'DELETE') {
          // Deleting a missing row is a no-op — already gone is the desired
          // state, matching the P2025-as-success handling in the Fastify
          // version.
          await tx`DELETE FROM ${tx(pgTable)} WHERE id = ${id}`;
        } else {
          throw new SyncOpError(id, table, `Unknown op: ${opType}`);
        }
        count += 1;
      }

      return count;
    });

    return { status: 200, body: { applied } };
  } catch (error) {
    const statusCode = error instanceof SyncOpError ? error.statusCode : 500;
    console.error('sync upload batch failed', {
      err: error.message,
      table: error.opTable,
      id: error.opId,
    });
    return {
      status: statusCode,
      body: {
        applied: 0,
        errors: [{ id: error.opId, table: error.opTable, error: error.message }],
      },
    };
  }
}
