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
    let message = `Request failed (${res.status})`;
    try {
      const json = JSON.parse(body) as { message?: string | string[] };
      const raw = json.message;
      message = Array.isArray(raw) ? raw.join(', ') : (raw ?? message);
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
