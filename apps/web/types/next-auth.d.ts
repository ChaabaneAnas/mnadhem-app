import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      activeTenantId: string | null;
      activeTenantName: string | null;
      locale: string | null;
    };
  }

  interface User {
    activeTenantId?: string | null;
    activeTenantName?: string | null;
    locale?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    activeTenantId?: string | null;
    activeTenantName?: string | null;
    locale?: string | null;
  }
}
