const fs = require('fs');
const path = require('path');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// Load RSA private key for RS256 JWT signing
const PRIVATE_KEY_PATH = path.join(__dirname, 'keys', 'jwt-private.pem');
const JWT_PRIVATE_KEY = fs.existsSync(PRIVATE_KEY_PATH)
  ? fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
  : process.env.JWT_SECRET || 'fitso-dev-secret-change-me';

const JWT_ALGORITHM = JWT_PRIVATE_KEY.includes('BEGIN') ? 'RS256' : 'HS256';
const JWT_AUDIENCE = 'powersync';

app.register(cors, { origin: '*' });

// Health checks
app.get('/health', async () => ({ status: 'ok', server: 'fastify-prisma' }));
app.get('/health/live', async () => ({ status: 'alive' }));

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_PRIVATE_KEY, {
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

function createToken(userId) {
  return jwt.sign({ sub: userId, aud: JWT_AUDIENCE }, JWT_PRIVATE_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '24h',
    keyid: 'fitso-jwt-key-1',
  });
}

// Auth: Sign Up
app.post('/api/auth/signup', async (request, reply) => {
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
app.post('/api/auth/login', async (request, reply) => {
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
    const nutrition = await prisma.nutritionLog.findUnique({
      where: {
        userId_logDate: { userId: request.userId, logDate: queryDateUTC },
      },
    });

    const recentWorkouts = await prisma.workout.findMany({
      where: { userId: request.userId },
      orderBy: { finishedAt: 'desc' },
      take: 3,
    });

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

// Bootstrap Server
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    app.log.info(`Server running on port 3000 (JWT: ${JWT_ALGORITHM})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
