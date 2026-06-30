import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      activeTenantId: string | null;
      activeTenantName: string | null;
    };
  }
}
