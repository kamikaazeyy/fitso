const fs = require('fs');
const path = require('path');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// Load RSA private key for RS256 JWT signing. HS256 via JWT_SECRET is a
// development fallback only — in production a missing key is a fatal
// misconfiguration, since a guessed/default secret would let anyone forge
// tokens (and therefore impersonate any user to PowerSync).
const PRIVATE_KEY_PATH = path.join(__dirname, 'keys', 'jwt-private.pem');
let JWT_PRIVATE_KEY = fs.existsSync(PRIVATE_KEY_PATH)
  ? fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
  : process.env.JWT_SECRET;

if (!JWT_PRIVATE_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'No JWT signing key configured. Mount keys/jwt-private.pem or set JWT_SECRET.'
    );
  }
  JWT_PRIVATE_KEY = 'fitso-dev-secret-change-me';
  app.log.warn('Using insecure development JWT secret — do not use in production');
}

const JWT_ALGORITHM = JWT_PRIVATE_KEY.includes('BEGIN') ? 'RS256' : 'HS256';
const JWT_AUDIENCE = 'powersync';

// RS256 tokens are verified with the PUBLIC key — the private key is only for
// signing. Falls back to the same value in HS256 dev mode.
const PUBLIC_KEY_PATH = path.join(__dirname, 'keys', 'jwt-public.pem');
const JWT_VERIFY_KEY =
  JWT_ALGORITHM === 'RS256' && fs.existsSync(PUBLIC_KEY_PATH)
    ? fs.readFileSync(PUBLIC_KEY_PATH, 'utf8')
    : JWT_PRIVATE_KEY;

app.register(cors, { origin: process.env.CORS_ORIGIN || '*' });

// Health checks
app.get('/health', async () => ({ status: 'ok', server: 'fastify-prisma' }));
app.get('/health/live', async () => ({ status: 'alive' }));

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_VERIFY_KEY, {
        algorithms: [JWT_ALGORITHM],
        audience: JWT_AUDIENCE,
      });
      request.userId = decoded.sub || decoded.userId;
      return;
    } catch (err) {
      app.log.warn('Invalid token:', err.message);
      return reply.code(401).send({ error: 'Unauthorized: invalid token' });
    }
  }

  return reply.code(401).send({ error: 'Unauthorized' });
}

// Fixed-window in-memory rate limiter for auth endpoints (brute-force
// protection). Single-process is fine — this server runs as one container.
const AUTH_RATE_MAX = 10;
const AUTH_RATE_WINDOW_MS = 60_000;
const authAttempts = new Map();

async function rateLimitAuth(request, reply) {
  const key = `${request.ip}:${request.routeOptions.url}`;
  const now = Date.now();

  // Opportunistically purge expired windows so the map doesn't grow forever.
  if (authAttempts.size > 1000) {
    for (const [k, v] of authAttempts) {
      if (now > v.resetAt) authAttempts.delete(k);
    }
  }

  let entry = authAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + AUTH_RATE_WINDOW_MS };
    authAttempts.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > AUTH_RATE_MAX) {
    return reply.code(429).send({ error: 'Too many attempts — try again later' });
  }
}

// The session token authenticates against this REST API and lasts a week.
// PowerSync rejects client JWTs whose iat→exp span exceeds 86400s
// (PSYNC_S2104), so tokens handed to the sync engine are minted separately
// with a shorter lifetime via POST /api/auth/sync-token.
const SESSION_TOKEN_TTL = '7d';
const SYNC_TOKEN_TTL = '24h';

function createToken(userId, expiresIn = SESSION_TOKEN_TTL) {
  return jwt.sign({ sub: userId, aud: JWT_AUDIENCE }, JWT_PRIVATE_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn,
    keyid: 'fitso-jwt-key-1',
  });
}

// Auth: Sign Up
app.post('/api/auth/signup', { preHandler: rateLimitAuth }, async (request, reply) => {
  const { email, password, name } = request.body || {};

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email and password are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return reply.code(409).send({ error: 'An account with that email already exists' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name: name || null, passwordHash },
    });

    const token = createToken(user.id);
    return reply.code(201).send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        dailyCalorieGoal: user.dailyCalorieGoal,
      },
    });
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to create account' });
  }
});

// Auth: Log In
app.post('/api/auth/login', { preHandler: rateLimitAuth }, async (request, reply) => {
  const { email, password } = request.body || {};

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = createToken(user.id);
    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        dailyCalorieGoal: user.dailyCalorieGoal,
      },
    });
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to log in' });
  }
});

// Auth: Verify token (used by mobile app to validate stored tokens)
app.get('/api/auth/verify', { preHandler: authenticate }, async (request, reply) => {
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { id: true, email: true, name: true, dailyCalorieGoal: true },
  });
  if (!user) {
    return reply.code(404).send({ error: 'User not found' });
  }
  return reply.send({ user });
});

// Auth: Refresh — exchange a still-valid session token for a freshly minted
// one. Fully expired tokens are rejected by `authenticate` (401); the client
// falls back to re-login in that case.
app.post('/api/auth/refresh', { preHandler: authenticate }, async (request, reply) => {
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { id: true, email: true, name: true, dailyCalorieGoal: true },
  });
  if (!user) {
    return reply.code(404).send({ error: 'User not found' });
  }
  return reply.send({ token: createToken(user.id), user });
});

// Auth: PowerSync sync token. The 7-day session token can't be used on the
// sync stream (PowerSync enforces iat→exp <= 86400s), so the connector trades
// it here for a short-lived token scoped to the same user.
app.post('/api/auth/sync-token', { preHandler: authenticate }, async (request, reply) => {
  return reply.send({ token: createToken(request.userId, SYNC_TOKEN_TTL) });
});

// 1. Post Workout Endpoint
app.post('/api/workouts', { preHandler: authenticate }, async (request, reply) => {
  const { title, durationSeconds, sets, splitId, routineId, startedAt, finishedAt } = request.body;

  try {
    const workout = await prisma.workout.create({
      data: {
        userId: request.userId,
        routineId: routineId || null,
        splitId: splitId || null,
        title: title || 'Workout',
        durationSeconds: durationSeconds || 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        finishedAt: finishedAt ? new Date(finishedAt) : new Date(),
        sets: {
          create: sets
            .filter((s) => s.weight !== undefined || s.reps !== undefined || s.isCompleted)
            .map((s, idx) => ({
              exerciseName: s.exerciseName,
              wgerId: s.wgerId || null,
              orderIndex: s.orderIndex ?? idx,
              setNumber: s.setNumber ?? idx + 1,
              setType: s.setType || 'NORMAL',
              weight: parseFloat(s.weight) || 0,
              reps: parseInt(s.reps, 10) || 0,
              rpe: s.rpe ? parseFloat(s.rpe) : null,
              isCompleted: s.isCompleted !== false,
              attachment: s.attachment || null,
            })),
        },
      },
      include: { sets: true },
    });
    return reply.code(201).send(workout);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to save workout' });
  }
});

// 1b. Get workouts for the authenticated user
app.get('/api/workouts', { preHandler: authenticate }, async (request, reply) => {
  const { limit = '50', offset = '0' } = request.query;
  const take = Math.min(parseInt(limit, 10) || 50, 100);
  const skip = parseInt(offset, 10) || 0;

  try {
    const workouts = await prisma.workout.findMany({
      where: { userId: request.userId },
      include: { sets: true },
      orderBy: { finishedAt: 'desc' },
      take,
      skip,
    });
    return reply.send(workouts);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to fetch workouts' });
  }
});

// 1c. Get a single workout
app.get('/api/workouts/:id', { preHandler: authenticate }, async (request, reply) => {
  const { id } = request.params;
  try {
    const workout = await prisma.workout.findFirst({
      where: { id, userId: request.userId },
      include: { sets: true },
    });
    if (!workout) {
      return reply.code(404).send({ error: 'Workout not found' });
    }
    return reply.send(workout);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to fetch workout' });
  }
});

// 2. Nutrition Upsert Endpoint
app.post('/api/nutrition/log', { preHandler: authenticate }, async (request, reply) => {
  const { date, calories, proteinG, carbsG, fatG } = request.body;
  const logDate = new Date(date);

  try {
    const nutrition = await prisma.nutritionLog.upsert({
      where: {
        userId_logDate: {
          userId: request.userId,
          logDate: logDate,
        },
      },
      update: {
        calories: { increment: calories || 0 },
        proteinG: { increment: proteinG || 0 },
        carbsG: { increment: carbsG || 0 },
        fatG: { increment: fatG || 0 },
      },
      create: {
        userId: request.userId,
        logDate: logDate,
        calories: calories || 0,
        proteinG: proteinG || 0,
        carbsG: carbsG || 0,
        fatG: fatG || 0,
      },
    });
    return reply.send(nutrition);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to log nutrition' });
  }
});

// 3. Dashboard Aggregator
app.get('/api/dashboard/today', { preHandler: authenticate }, async (request, reply) => {
  const dateString = request.query.date || new Date().toISOString().split('T')[0];
  const queryDateUTC = new Date(dateString);

  try {
    const [nutrition, recentWorkouts] = await Promise.all([
      prisma.nutritionLog.findUnique({
        where: {
          userId_logDate: { userId: request.userId, logDate: queryDateUTC },
        },
      }),
      prisma.workout.findMany({
        where: { userId: request.userId },
        orderBy: { finishedAt: 'desc' },
        take: 3,
      }),
    ]);

    return reply.send({
      nutrition: nutrition || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      recentWorkouts,
    });
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to fetch dashboard' });
  }
});

// 4. Routines & Splits

// List routines for the authenticated user
app.get('/api/routines', { preHandler: authenticate }, async (request, reply) => {
  try {
    const routines = await prisma.routine.findMany({
      where: { userId: request.userId },
      include: {
        splits: {
          orderBy: { orderIndex: 'asc' },
          include: {
            exercises: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(routines);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to fetch routines' });
  }
});

// Get a single routine
app.get('/api/routines/:id', { preHandler: authenticate }, async (request, reply) => {
  const { id } = request.params;
  try {
    const routine = await prisma.routine.findFirst({
      where: { id, userId: request.userId },
      include: {
        splits: {
          orderBy: { orderIndex: 'asc' },
          include: {
            exercises: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });
    if (!routine) {
      return reply.code(404).send({ error: 'Routine not found' });
    }
    return reply.send(routine);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to fetch routine' });
  }
});

// Create a routine with splits and exercises
app.post('/api/routines', { preHandler: authenticate }, async (request, reply) => {
  const { name, notes, splits } = request.body || {};

  if (!name || !Array.isArray(splits) || splits.length === 0) {
    return reply.code(400).send({ error: 'Routine name and at least one split are required' });
  }

  try {
    const routine = await prisma.routine.create({
      data: {
        userId: request.userId,
        name,
        notes: notes || null,
        splits: {
          create: splits.map((split, splitIndex) => ({
            name: split.name || `Split ${splitIndex + 1}`,
            orderIndex: split.orderIndex ?? splitIndex,
            exercises: {
              create: (split.exercises || []).map((ex, exIndex) => ({
                wgerId: ex.wgerId || null,
                exerciseName: ex.exerciseName,
                equipment: ex.equipment || [],
                attachment: ex.attachment || null,
                orderIndex: ex.orderIndex ?? exIndex,
                targetSets: ex.targetSets || null,
                targetReps: ex.targetReps || null,
                targetWeight: ex.targetWeight ? parseFloat(ex.targetWeight) : null,
                restSeconds: ex.restSeconds || null,
              })),
            },
          })),
        },
      },
      include: {
        splits: {
          include: { exercises: true },
        },
      },
    });
    return reply.code(201).send(routine);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to create routine' });
  }
});

// Delete a routine
app.delete('/api/routines/:id', { preHandler: authenticate }, async (request, reply) => {
  const { id } = request.params;
  try {
    const existing = await prisma.routine.findFirst({ where: { id, userId: request.userId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Routine not found' });
    }
    await prisma.routine.delete({ where: { id } });
    return reply.send({ success: true });
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to delete routine' });
  }
});

// 5. PowerSync sync upload — applies local CRUD operations to Postgres
//
// PowerSync's sync protocol handles the download direction (server → client)
// automatically. The upload direction (client → server) is the connector's
// job: the mobile app's `uploadData` POSTs a batch of CRUD operations here,
// and this endpoint applies them to Postgres via Prisma. Once applied,
// PowerSync's logical replication picks them up and streams them back down
// to all of the user's devices.

const TABLE_TO_PRISMA = {
  workouts: 'workout',
  workout_sets: 'workoutSet',
  routines: 'routine',
  splits: 'split',
  routine_exercises: 'routineExercise',
  custom_exercises: 'customExercise',
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
  rpe: 'rpe',
  attachment: 'attachment',
  equipment: 'equipment',
  category: 'category',
  muscles: 'muscles',
};

// Tables that have a direct userId column — the server overrides this field
// with the authenticated user's id to prevent cross-user writes.
const TABLES_WITH_USER_ID = new Set(['workouts', 'routines', 'custom_exercises']);

// Fields that are NOT nullable in the Prisma schema but may arrive as null
// from SQLite (the user left the field empty). Coerce to the schema default
// so Prisma doesn't reject the upsert.
const NON_NULLABLE_DEFAULTS = {
  weight: 0,
  reps: 0,
  is_completed: false,
  set_type: 'NORMAL',
  order_index: 0,
  set_number: 0,
  duration_seconds: 0,
};

// Error type for a single failed sync operation. Carries enough context to
// report back to the client; thrown inside the upload transaction so the
// whole batch rolls back.
class SyncOpError extends Error {
  constructor(id, table, message, statusCode = 500) {
    super(message);
    this.opId = id;
    this.opTable = table;
    this.statusCode = statusCode;
  }
}

// Runs `fn` once per `key` within a batch — a workout upload carries one op
// per set, so without this the same parent row is re-SELECTed for every set.
async function cachedLookup(cache, key, fn) {
  if (!cache.has(key)) cache.set(key, await fn());
  return cache.get(key);
}

// Resolves which user owns row `id` in `table`, walking up the parent chain
// for child tables (workout_sets → workout, splits → routine,
// routine_exercises → split → routine). For PUT creates the row doesn't
// exist yet, so the parent id is taken from opData instead. Returns null
// when no owner can be determined — e.g. a create whose parent isn't in
// Postgres yet; the FK constraint will reject the write anyway.
async function resolveOwnerId(table, id, opData, tx, cache) {
  const userIdOf = (row) => row?.userId ?? null;
  const workoutOwner = (workoutId) =>
    cachedLookup(cache, `workout:${workoutId}`, async () =>
      userIdOf(await tx.workout.findUnique({ where: { id: workoutId }, select: { userId: true } }))
    );
  const routineOwner = (routineId) =>
    cachedLookup(cache, `routine:${routineId}`, async () =>
      userIdOf(await tx.routine.findUnique({ where: { id: routineId }, select: { userId: true } }))
    );
  const customExerciseOwner = (customExerciseId) =>
    cachedLookup(cache, `custom_exercise:${customExerciseId}`, async () =>
      userIdOf(
        await tx.customExercise.findUnique({ where: { id: customExerciseId }, select: { userId: true } })
      )
    );

  switch (table) {
    case 'workouts':
      return workoutOwner(id);
    case 'routines':
      return routineOwner(id);
    case 'custom_exercises':
      return customExerciseOwner(id);
    case 'workout_sets': {
      const row = await cachedLookup(cache, `workout_set:${id}`, () =>
        tx.workoutSet.findUnique({ where: { id }, select: { workoutId: true } })
      );
      const workoutId = row?.workoutId ?? opData.workoutId;
      if (!workoutId) return null;
      return workoutOwner(workoutId);
    }
    case 'splits': {
      const row = await cachedLookup(cache, `split:${id}`, () =>
        tx.split.findUnique({ where: { id }, select: { routineId: true } })
      );
      const routineId = row?.routineId ?? opData.routineId;
      if (!routineId) return null;
      return routineOwner(routineId);
    }
    case 'routine_exercises': {
      const row = await cachedLookup(cache, `routine_exercise:${id}`, () =>
        tx.routineExercise.findUnique({ where: { id }, select: { splitId: true } })
      );
      const splitId = row?.splitId ?? opData.splitId;
      if (!splitId) return null;
      return cachedLookup(cache, `split_owner:${splitId}`, async () => {
        const split = await tx.split.findUnique({
          where: { id: splitId },
          select: { routine: { select: { userId: true } } },
        });
        return split?.routine?.userId ?? null;
      });
    }
    default:
      return null;
  }
}

function transformOpData(table, opData) {
  const transformed = {};
  for (const [key, value] of Object.entries(opData)) {
    const prismaKey = COLUMN_MAP[key] || key;
    let transformedValue = value;

    // Coerce null to the schema default for non-nullable fields
    if (transformedValue === null && key in NON_NULLABLE_DEFAULTS) {
      transformedValue = NON_NULLABLE_DEFAULTS[key];
    }

    // SQLite stores booleans as 0/1; Prisma expects true/false
    if (key === 'is_completed') {
      transformedValue = transformedValue === 1 || transformedValue === true;
    }

    // SQLite stores String[] as a JSON string; Prisma expects an array
    if ((key === 'equipment' || key === 'muscles') && typeof transformedValue === 'string') {
      try {
        transformedValue = JSON.parse(transformedValue);
      } catch {
        transformedValue = [];
      }
    }

    // SQLite stores dates as ISO strings; convert to Date for Prisma
    if (typeof transformedValue === 'string' && (key.endsWith('_at') || key === 'logDate')) {
      const parsed = new Date(transformedValue);
      if (!Number.isNaN(parsed.getTime())) {
        transformedValue = parsed;
      }
    }

    transformed[prismaKey] = transformedValue;
  }
  return transformed;
}

app.post('/api/sync/upload', { preHandler: authenticate }, async (request, reply) => {
  const { operations } = request.body || {};
  if (!Array.isArray(operations) || operations.length === 0) {
    return reply.send({ applied: 0 });
  }

  try {
    // Apply the batch atomically. Ops are idempotent and the client retries
    // the whole batch on failure, so all-or-nothing is safe and prevents
    // partial state if a mid-batch op fails.
    const applied = await prisma.$transaction(async (tx) => {
      let count = 0;
      const ownerCache = new Map();

      for (const op of operations) {
        const { table, op: opType, id, data } = op;
        const modelName = TABLE_TO_PRISMA[table];

        if (!modelName) {
          throw new SyncOpError(id, table, `Unknown table: ${table}`);
        }

        const prismaModel = tx[modelName];
        const opData = transformOpData(table, data || {});

        // Security: override userId with the authenticated user's id so a
        // compromised client can't write data to another user's account.
        if (TABLES_WITH_USER_ID.has(table)) {
          opData.userId = request.userId;
        }

        // Security: verify ownership of the target row (or its parent for
        // child tables). Without this, a client could UPDATE/DELETE another
        // user's rows, or INSERT a child row under another user's parent.
        const ownerId = await resolveOwnerId(table, id, opData, tx, ownerCache);
        if (ownerId && ownerId !== request.userId) {
          throw new SyncOpError(id, table, 'Row belongs to another user', 403);
        }

        if (opType === 'PUT') {
          // Upsert (INSERT or replace)
          await prismaModel.upsert({
            where: { id },
            create: { ...opData, id },
            update: opData,
          });
        } else if (opType === 'PATCH') {
          // Update only — no upsert. A PATCH carrying partial opData must not
          // create a half-populated row if the original PUT hasn't been
          // applied yet (reordered/retried ops). P2025 (row missing) means
          // there is nothing to patch, which is the desired end state.
          try {
            await prismaModel.update({ where: { id }, data: opData });
          } catch (error) {
            if (error.code !== 'P2025') throw error;
          }
        } else if (opType === 'DELETE') {
          try {
            await prismaModel.delete({ where: { id } });
          } catch (error) {
            // P2025 = record not found — it's already gone, which is the
            // desired state. Treat as success instead of poisoning the queue.
            if (error.code !== 'P2025') throw error;
          }
        } else {
          throw new SyncOpError(id, table, `Unknown op: ${opType}`);
        }
        count += 1;
      }

      return count;
    });

    return reply.send({ applied });
  } catch (error) {
    const statusCode = error instanceof SyncOpError ? error.statusCode : 500;
    app.log.error(
      { err: error.message, table: error.opTable, id: error.opId },
      'sync upload batch failed'
    );
    return reply.code(statusCode).send({
      applied: 0,
      errors: [{ id: error.opId, table: error.opTable, error: error.message }],
    });
  }
});

// Bootstrap Server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT, 10) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Server running on port ${port} (JWT: ${JWT_ALGORITHM})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
