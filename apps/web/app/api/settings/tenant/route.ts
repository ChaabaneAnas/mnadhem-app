import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiRequest } from '@/lib/api';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as Record<string, unknown>;

  try {
    const updated = await apiRequest(`/tenants/${session.user.activeTenantId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500 },
    );
  }
}
