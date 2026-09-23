import { jwtDecode } from 'jwt-decode';

/** Returns the JWT `exp` claim in seconds since epoch, or null if unparseable. */
export function decodeJwtExp(token: string): number | null {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}
