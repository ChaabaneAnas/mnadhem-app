import 'server-only';
import { SignJWT } from 'jose';
import { auth } from '@/auth';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getToken(userId: string, tenantId: string): Promise<string> {
  return new SignJWT({ userId, activeTenantId: tenantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function apiRequest<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const session = await auth();
  if (!session?.user?.id || !session.user.activeTenantId) {
    throw new Error('Not authenticated or no active tenant');
  }

  const token = await getToken(session.user.id, session.user.activeTenantId);

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    // The backend returns a stable `code` (e.g. ORDER_NOT_FOUND) that the
    // client maps to a translated message via `useErrorMessage`. We carry the
    // code in the Error message so it survives the Server Action boundary.
    let code = 'unknown';
    try {
      const json = JSON.parse(body) as { code?: string };
      if (json.code) code = json.code;
    } catch {
      // Non-JSON body — leave as generic 'unknown'.
    }
    throw new Error(code);
  }

  return res.json() as Promise<T>;
}
