import { getSql, coerceDecimals } from './lib/db.js';
import { hashPassword, verifyPassword } from './lib/password.js';
import { createToken, verifyJwt } from './lib/jwt.js';
import { handleSyncUpload } from './sync.js';

// ---------------------------------------------------------------------------
// Tiny router — Workers has no Fastify; match on method + path params.
// ---------------------------------------------------------------------------

const routes = [];

function route(method, pattern, handler, opts = {}) {
  const paramNames = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:[^/]+/g, (m) => {
        paramNames.push(m.slice(1));
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ method, regex, paramNames, handler, auth: opts.auth !== false });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function authenticate(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { response: json({ error: 'Unauthorized' }, 401) };

  const payload = await verifyJwt(token, env.JWT_PUBLIC_KEY || env.JWT_PRIVATE_KEY, env.JWT_AUDIENCE);
  if (!payload) return { response: json({ error: 'Unauthorized: invalid token' }, 401) };

  return { userId: payload.sub || payload.userId };
}

// Fixed-window in-memory rate limiter for auth endpoints (brute-force
// protection). Best-effort only on Workers — the limit applies per isolate,
// not globally, since isolates don't share memory.
const AUTH_RATE_MAX = 10;
const AUTH_RATE_WINDOW_MS = 60_000;
const authAttempts = new Map();

function rateLimitAuth(request, url) {
  const key = `${request.headers.get('cf-connecting-ip') || 'unknown'}:${url.pathname}`;
  const now = Date.now();

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
  return entry.count > AUTH_RATE_MAX;
}

async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function err(msg, status = 500) {
  return json({ error: msg }, status);
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

route('GET', '/health', () => json({ status: 'ok', server: 'cloudflare-worker' }), {
  auth: false,
});
route('GET', '/health/live', () => json({ status: 'alive' }), { auth: false });

// JWKS — the PowerSync service verifies sync-token signatures against this.
// Public key material only; safe to serve unauthenticated.
route('GET', '/.well-known/jwks.json', async (_body, { env }) => {
  const pem = env.JWT_PUBLIC_KEY || env.JWT_PRIVATE_KEY;
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  const key = await crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return json({
    keys: [{ ...jwk, alg: 'RS256', kid: env.JWT_KEY_ID, use: 'sig' }],
  });
}, { auth: false });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMITED = new Set(['/api/auth/signup', '/api/auth/login']);
const USER_COLS = ['id', 'email', 'name', 'dailyCalorieGoal'];

route('POST', '/api/auth/signup', async (body, { env, sql }) => {
  const { email, password, name } = body;

  if (!email || !password) return err('Email and password are required', 400);
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return err('Invalid email address', 400);
  }
  if (typeof password !== 'string' || password.length < 6) {
    return err('Password must be at least 6 characters', 400);
  }

  const normalizedEmail = email.trim();
  try {
    const existing = await sql`SELECT id FROM "User" WHERE email = ${normalizedEmail}`;
    if (existing.length) {
      return err('An account with that email already exists', 409);
    }

    const passwordHash = await hashPassword(password);
    const [user] = await sql`
      INSERT INTO "User" (email, name, "passwordHash")
      VALUES (${normalizedEmail}, ${name || null}, ${passwordHash})
      RETURNING ${sql(USER_COLS)}
    `;

    const token = await createToken(env, user.id, env.SESSION_TOKEN_TTL_SECONDS);
    return json({ token, user }, 201);
  } catch (e) {
    console.error(e);
    return err('Failed to create account');
  }
}, { auth: false });

route('POST', '/api/auth/login', async (body, { env, sql }) => {
  const { email, password } = body;
  if (!email || !password) return err('Email and password are required', 400);

  try {
    const rows = await sql`
      SELECT ${sql(USER_COLS)}, "passwordHash"
      FROM "User" WHERE email = ${String(email).trim()}
    `;
    const user = rows[0];
    if (!user || !user.passwordHash) return err('Invalid email or password', 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return err('Invalid email or password', 401);

    const { passwordHash, ...publicUser } = user;
    const token = await createToken(env, user.id, env.SESSION_TOKEN_TTL_SECONDS);
    return json({ token, user: publicUser });
  } catch (e) {
    console.error(e);
    return err('Failed to log in');
  }
}, { auth: false });

route('GET', '/api/auth/verify', async (_body, { userId, sql }) => {
  const rows = await sql`SELECT ${sql(USER_COLS)} FROM "User" WHERE id = ${userId}`;
  if (!rows[0]) return err('User not found', 404);
  return json({ user: rows[0] });
});

route('POST', '/api/auth/refresh', async (_body, { userId, env, sql }) => {
  const rows = await sql`SELECT ${sql(USER_COLS)} FROM "User" WHERE id = ${userId}`;
  if (!rows[0]) return err('User not found', 404);
  const token = await createToken(env, rows[0].id, env.SESSION_TOKEN_TTL_SECONDS);
  return json({ token, user: rows[0] });
});

// PowerSync sync token — the 7-day session token can't go on the sync stream
// (PowerSync enforces iat→exp <= 86400s), so mint a short-lived one here.
route('POST', '/api/auth/sync-token', async (_body, { userId, env }) => {
  const token = await createToken(env, userId, env.SYNC_TOKEN_TTL_SECONDS);
  return json({ token });
});

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

route('POST', '/api/workouts', async (body, { userId, sql }) => {
  const { title, durationSeconds, sets = [], splitId, routineId, startedAt, finishedAt } = body;

  try {
    const workout = await sql.begin(async (tx) => {
      const [w] = await tx`
        INSERT INTO "Workout" ${tx({
          userId,
          routineId: routineId || null,
          splitId: splitId || null,
          title: title || 'Workout',
          durationSeconds: durationSeconds || 0,
          startedAt: startedAt ? new Date(startedAt) : new Date(),
          finishedAt: finishedAt ? new Date(finishedAt) : new Date(),
        })}
        RETURNING *
      `;

      const filtered = sets.filter(
        (s) => s.weight !== undefined || s.reps !== undefined || s.isCompleted
      );
      for (const [idx, s] of filtered.entries()) {
        await tx`
          INSERT INTO "WorkoutSet" ${tx({
            workoutId: w.id,
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
          })}
        `;
      }
      w.sets = await tx`SELECT * FROM "WorkoutSet" WHERE "workoutId" = ${w.id}`;
      return w;
    });

    coerceDecimals(workout, 'Workout');
    for (const s of workout.sets) coerceDecimals(s, 'WorkoutSet');
    return json(workout, 201);
  } catch (e) {
    console.error(e);
    return err('Failed to save workout');
  }
});

route('GET', '/api/workouts', async (_body, { userId, url, sql }) => {
  const take = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);
  const skip = parseInt(url.searchParams.get('offset') || '0', 10) || 0;

  try {
    const workouts = await sql`
      SELECT * FROM "Workout" WHERE "userId" = ${userId}
      ORDER BY "finishedAt" DESC LIMIT ${take} OFFSET ${skip}
    `;
    if (workouts.length) {
      const sets = await sql`
        SELECT * FROM "WorkoutSet" WHERE "workoutId" IN ${sql(workouts.map((w) => w.id))}
      `;
      const byWorkout = new Map();
      for (const s of sets) {
        coerceDecimals(s, 'WorkoutSet');
        if (!byWorkout.has(s.workoutId)) byWorkout.set(s.workoutId, []);
        byWorkout.get(s.workoutId).push(s);
      }
      for (const w of workouts) w.sets = byWorkout.get(w.id) || [];
    }
    for (const w of workouts) coerceDecimals(w, 'Workout');
    return json(workouts);
  } catch (e) {
    console.error(e);
    return err('Failed to fetch workouts');
  }
});

route('GET', '/api/workouts/:id', async (_body, { userId, params, sql }) => {
  try {
    const rows = await sql`SELECT * FROM "Workout" WHERE id = ${params.id} AND "userId" = ${userId}`;
    if (!rows[0]) return err('Workout not found', 404);
    const workout = rows[0];
    workout.sets = await sql`SELECT * FROM "WorkoutSet" WHERE "workoutId" = ${workout.id}`;
    coerceDecimals(workout, 'Workout');
    for (const s of workout.sets) coerceDecimals(s, 'WorkoutSet');
    return json(workout);
  } catch (e) {
    console.error(e);
    return err('Failed to fetch workout');
  }
});

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

route('POST', '/api/nutrition/log', async (body, { userId, sql }) => {
  const { date, calories, proteinG, carbsG, fatG } = body;
  const logDate = new Date(date);

  try {
    const [row] = await sql`
      INSERT INTO "NutritionLog" ("userId", "logDate", calories, "proteinG", "carbsG", "fatG")
      VALUES (${userId}, ${logDate}, ${calories || 0}, ${proteinG || 0}, ${carbsG || 0}, ${fatG || 0})
      ON CONFLICT ("userId", "logDate") DO UPDATE SET
        calories   = "NutritionLog".calories   + EXCLUDED.calories,
        "proteinG" = "NutritionLog"."proteinG" + EXCLUDED."proteinG",
        "carbsG"   = "NutritionLog"."carbsG"   + EXCLUDED."carbsG",
        "fatG"     = "NutritionLog"."fatG"     + EXCLUDED."fatG"
      RETURNING *
    `;
    return json(row);
  } catch (e) {
    console.error(e);
    return err('Failed to log nutrition');
  }
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

route('GET', '/api/dashboard/today', async (_body, { userId, url, sql }) => {
  const dateString = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const queryDateUTC = new Date(dateString);

  try {
    const [nutritionRows, recentWorkouts] = await Promise.all([
      sql`SELECT * FROM "NutritionLog" WHERE "userId" = ${userId} AND "logDate" = ${queryDateUTC}`,
      sql`SELECT * FROM "Workout" WHERE "userId" = ${userId} ORDER BY "finishedAt" DESC LIMIT 3`,
    ]);
    for (const w of recentWorkouts) coerceDecimals(w, 'Workout');
    return json({
      nutrition: nutritionRows[0] || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      recentWorkouts,
    });
  } catch (e) {
    console.error(e);
    return err('Failed to fetch dashboard');
  }
});

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

async function fetchRoutineTree(sql, whereFragment) {
  const routines = await sql`SELECT * FROM "Routine" ${whereFragment} ORDER BY "createdAt" DESC`;
  if (!routines.length) return routines;

  const splits = await sql`
    SELECT * FROM "Split" WHERE "routineId" IN ${sql(routines.map((r) => r.id))}
    ORDER BY "orderIndex" ASC
  `;
  const exercises = splits.length
    ? await sql`
        SELECT * FROM "RoutineExercise" WHERE "splitId" IN ${sql(splits.map((s) => s.id))}
        ORDER BY "orderIndex" ASC
      `
    : [];

  const exBySplit = new Map();
  for (const ex of exercises) {
    coerceDecimals(ex, 'RoutineExercise');
    if (!exBySplit.has(ex.splitId)) exBySplit.set(ex.splitId, []);
    exBySplit.get(ex.splitId).push(ex);
  }
  const splitsByRoutine = new Map();
  for (const s of splits) {
    s.exercises = exBySplit.get(s.id) || [];
    if (!splitsByRoutine.has(s.routineId)) splitsByRoutine.set(s.routineId, []);
    splitsByRoutine.get(s.routineId).push(s);
  }
  for (const r of routines) r.splits = splitsByRoutine.get(r.id) || [];
  return routines;
}

route('GET', '/api/routines', async (_body, { userId, sql }) => {
  try {
    return json(await fetchRoutineTree(sql, sql`WHERE "userId" = ${userId}`));
  } catch (e) {
    console.error(e);
    return err('Failed to fetch routines');
  }
});

route('GET', '/api/routines/:id', async (_body, { userId, params, sql }) => {
  try {
    const routines = await fetchRoutineTree(
      sql,
      sql`WHERE id = ${params.id} AND "userId" = ${userId}`
    );
    if (!routines[0]) return err('Routine not found', 404);
    return json(routines[0]);
  } catch (e) {
    console.error(e);
    return err('Failed to fetch routine');
  }
});

route('POST', '/api/routines', async (body, { userId, sql }) => {
  const { name, notes, splits } = body;
  if (!name || !Array.isArray(splits) || splits.length === 0) {
    return err('Routine name and at least one split are required', 400);
  }

  try {
    const routineId = crypto.randomUUID();
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO "Routine" ${tx({
          id: routineId,
          userId,
          name,
          notes: notes || null,
          updatedAt: new Date(),
        })}
      `;
      for (const [splitIndex, split] of splits.entries()) {
        const splitId = crypto.randomUUID();
        await tx`
          INSERT INTO "Split" ${tx({
            id: splitId,
            routineId,
            name: split.name || `Split ${splitIndex + 1}`,
            orderIndex: split.orderIndex ?? splitIndex,
          })}
        `;
        for (const [exIndex, ex] of (split.exercises || []).entries()) {
          await tx`
            INSERT INTO "RoutineExercise" ${tx({
              id: crypto.randomUUID(),
              splitId,
              wgerId: ex.wgerId || null,
              exerciseName: ex.exerciseName,
              equipment: ex.equipment || [],
              attachment: ex.attachment || null,
              orderIndex: ex.orderIndex ?? exIndex,
              targetSets: ex.targetSets || null,
              targetReps: ex.targetReps || null,
              targetWeight: ex.targetWeight ? parseFloat(ex.targetWeight) : null,
              restSeconds: ex.restSeconds || null,
            })}
          `;
        }
      }
    });

    const routines = await fetchRoutineTree(sql, sql`WHERE id = ${routineId}`);
    return json(routines[0], 201);
  } catch (e) {
    console.error(e);
    return err('Failed to create routine');
  }
});

route('DELETE', '/api/routines/:id', async (_body, { userId, params, sql }) => {
  try {
    const rows = await sql`SELECT id FROM "Routine" WHERE id = ${params.id} AND "userId" = ${userId}`;
    if (!rows[0]) return err('Routine not found', 404);
    await sql`DELETE FROM "Routine" WHERE id = ${params.id}`;
    return json({ success: true });
  } catch (e) {
    console.error(e);
    return err('Failed to delete routine');
  }
});

// ---------------------------------------------------------------------------
// PowerSync sync upload
// ---------------------------------------------------------------------------

route('POST', '/api/sync/upload', async (body, { userId, sql }) => {
  const { status, body: responseBody } = await handleSyncUpload(body, userId, sql);
  return json(responseBody, status);
});

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, execCtx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    for (const r of routes) {
      if (r.method !== request.method) continue;
      const match = url.pathname.match(r.regex);
      if (!match) continue;

      const ctx = { env, url, params: {}, sql: getSql(env) };
      r.paramNames.forEach((name, i) => {
        ctx.params[name] = decodeURIComponent(match[i + 1]);
      });

      try {
        if (RATE_LIMITED.has(url.pathname) && rateLimitAuth(request, url)) {
          return err('Too many attempts — try again later', 429);
        }

        if (r.auth) {
          const auth = await authenticate(request, env);
          if (auth.response) return auth.response;
          ctx.userId = auth.userId;
        }

        const body = ['POST', 'PUT', 'PATCH'].includes(request.method)
          ? await readBody(request)
          : {};
        return await r.handler(body, ctx);
      } catch (e) {
        console.error(e);
        return err('Internal server error');
      } finally {
        // The sql client is lazy — no connection exists unless a query ran,
        // so end() is a no-op for token-only and rejected requests.
        execCtx.waitUntil(ctx.sql.end({ timeout: 5 }).catch(() => {}));
      }
    }

    return err('Not found', 404);
  },
};
