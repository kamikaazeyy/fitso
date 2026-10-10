// RS256 JWT sign/verify on WebCrypto — replaces jsonwebtoken, which relies on
// Node APIs that don't exist in the Workers runtime.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function importKey(pem, usages) {
  const format = pem.includes('PRIVATE KEY') ? 'pkcs8' : 'spki';
  return crypto.subtle.importKey(
    format,
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    usages
  );
}

export async function signJwt(payload, privateKeyPem, kid) {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const data =
    bytesToB64Url(encoder.encode(JSON.stringify(header))) +
    '.' +
    bytesToB64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(privateKeyPem, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(data));
  return `${data}.${bytesToB64Url(new Uint8Array(sig))}`;
}

// Returns the decoded payload, or null for any failure (bad signature,
// expired, wrong audience). Mirrors the options the Fastify server passed to
// jwt.verify: RS256 only, audience enforced, exp checked.
export async function verifyJwt(token, publicKeyPem, audience) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  let header, payload;
  try {
    header = JSON.parse(decoder.decode(b64UrlToBytes(h)));
    payload = JSON.parse(decoder.decode(b64UrlToBytes(p)));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;

  const key = await importKey(publicKeyPem, ['verify']);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64UrlToBytes(s),
    encoder.encode(`${h}.${p}`)
  );
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && now >= payload.exp) return null;
  if (audience && payload.aud !== audience) return null;

  return payload;
}

export function createToken(env, userId, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { sub: userId, aud: env.JWT_AUDIENCE, iat: now, exp: now + Number(ttlSeconds) },
    env.JWT_PRIVATE_KEY,
    env.JWT_KEY_ID
  );
}
