const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { PrismaClient } = require('@prisma/client');

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// Temporary dummy user ID for development since Auth isn't wired yet
let DEV_USER_ID = null;

app.register(cors, { origin: '*' });

// Health checks (Keeps the Tailscale ping test working)
app.get('/health', async () => ({ status: 'ok', server: 'fastify-prisma' }));
app.get('/health/live', async () => ({ status: 'alive' }));

// 1. Post Workout Endpoint
app.post('/api/workouts', async (request, reply) => {
  const { title, durationSeconds, sets } = request.body;

  try {
    // Using Prisma's nested create to ensure sets and workout are saved in one transaction
    const workout = await prisma.workout.create({
      data: {
        userId: DEV_USER_ID,
        title,
        durationSeconds: durationSeconds || 0,
        sets: {
          create: sets.map(s => ({
            exerciseName: s.exerciseName,
            wgerId: s.wgerId,
            setNumber: s.setNumber,
            weightKg: s.weightKg,
            reps: s.reps,
            completed: s.completed !== false
          }))
        }
      },
      include: { sets: true } // Return the created sets in the response
    });
    return reply.code(201).send(workout);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to save workout' });
  }
});

// 2. Nutrition Upsert Endpoint
app.post('/api/nutrition/log', async (request, reply) => {
  const { date, calories, proteinG, carbsG, fatG } = request.body;
  const logDate = new Date(date);

  try {
    // Upsert ensures we only have one row per user per day
    const nutrition = await prisma.nutritionLog.upsert({
      where: {
        userId_logDate: {
          userId: DEV_USER_ID,
          logDate: logDate
        }
      },
      update: {
        calories: { increment: calories || 0 },
        proteinG: { increment: proteinG || 0 },
        carbsG: { increment: carbsG || 0 },
        fatG: { increment: fatG || 0 },
      },
      create: {
        userId: DEV_USER_ID,
        logDate: logDate,
        calories: calories || 0,
        proteinG: proteinG || 0,
        carbsG: carbsG || 0,
        fatG: fatG || 0,
      }
    });
    return reply.send(nutrition);
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to log nutrition' });
  }
});

// 3. Dashboard Aggregator
app.get('/api/dashboard/today', async (request, reply) => {
  // Expect the client to pass their local 'today' (e.g., ?date=2026-08-09)
  // Fallback to server's current UTC date if missing
  const dateString = request.query.date || new Date().toISOString().split('T')[0];
  const queryDateUTC = new Date(dateString); // Parses to UTC midnight

  try {
    const nutrition = await prisma.nutritionLog.findUnique({
      where: {
        userId_logDate: { userId: DEV_USER_ID, logDate: queryDateUTC }
      }
    });

    const recentWorkouts = await prisma.workout.findMany({
      where: { userId: DEV_USER_ID },
      orderBy: { completedAt: 'desc' },
      take: 3
    });

    return reply.send({
      nutrition: nutrition || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      recentWorkouts
    });
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Failed to fetch dashboard' });
  }
});

// Bootstrap Server
const start = async () => {
  try {
    // Ensure a dev user exists for foreign keys
    let devUser = await prisma.user.findFirst();
    if (!devUser) {
      devUser = await prisma.user.create({
        data: { email: 'dev@fitso.app', name: 'Developer', dailyCalorieGoal: 2500 }
      });
      app.log.info(`Created dev user: ${devUser.id}`);
    }
    DEV_USER_ID = devUser.id;

    // Use 0.0.0.0 so it is reachable outside the container
    await app.listen({ port: 3000, host: '0.0.0.0' });
    app.log.info(`Server running on port 3000`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
