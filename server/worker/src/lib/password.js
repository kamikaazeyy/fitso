import bcrypt from 'bcryptjs';

// Password hashing for the Workers runtime. bcryptjs is pure JS and burns
// real CPU time — well over the Free plan's CPU allowance at cost 10.
// PBKDF2 via WebCrypto runs natively in workerd (off the isolate's CPU
// budget) and meets OWASP's 600k-iteration recommendation for SHA-256.
//
// Stored format: pbkdf2$<iterations>$<salt_b64url>$<hash_b64url>
// bcrypt hashes ($2a$/$2b$) still verify via bcryptjs so users created by the
// old Fastify backend (if the DB is ever seeded from it) can log in.

const encoder = new TextEncoder();
// workerd rejects PBKDF2 iteration counts above 100k — this is the platform
// maximum and still well above NIST's 10k floor.
const PBKDF2_ITERATIONS = 100_000;

function bytesToB64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64Url(salt)}$${bytesToB64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  if (stored?.startsWith('pbkdf2$')) {
    const [, iterStr, saltB64, hashB64] = stored.split('$');
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
      'deriveBits',
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64UrlToBytes(saltB64), iterations: Number(iterStr) },
      key,
      256
    );
    return crypto.subtle.timingSafeEqual(new Uint8Array(bits), b64UrlToBytes(hashB64));
  }
  // Legacy bcrypt hash created by the Fastify backend.
  return bcrypt.compare(password, stored);
}
