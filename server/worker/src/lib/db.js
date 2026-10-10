import postgres from 'postgres';

// One sql client per request. Hyperdrive does the real connection pooling to
// Supabase, so per-request clients are cheap and avoid leaking sockets across
// requests. Callers should `ctx.waitUntil(sql.end())` when done.
//
// prepare:false — Supabase's Supavisor pooler does not support prepared
// statements on its transaction port, and disabling them is harmless on the
// session port too.
export function getSql(env) {
  return postgres(env.HYPERDRIVE.connectionString, {
    max: 5,
    // Supabase's Supavisor pooler (transaction mode) doesn't support prepared
    // statements — must stay off.
    prepare: false,
    // Fail fast instead of hanging a request when the upstream is unreachable,
    // and close pooled connections quickly so a stale Supavisor session can't
    // hang the next query.
    connect_timeout: 15,
    idle_timeout: 5,
  });
}

// Postgres numeric/decimal columns come back as strings. Cast them to JS
// numbers so responses match what Prisma's JSON serialization produced.
const DECIMAL_FIELDS = {
  Workout: ['distanceMeters', 'maxSpeedMps', 'elevationGainMeters'],
  WorkoutSet: ['weight', 'weightLeft', 'weightRight', 'rpe'],
  RoutineExercise: ['targetWeight'],
};

export function coerceDecimals(row, table) {
  const fields = DECIMAL_FIELDS[table];
  if (!fields || !row) return row;
  for (const f of fields) {
    if (row[f] !== null && row[f] !== undefined) row[f] = parseFloat(row[f]);
  }
  return row;
}
