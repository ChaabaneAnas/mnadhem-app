import type { NextAuthConfig } from 'next-auth';

// Edge-safe auth config — no Node.js imports (no pg, bcrypt, prisma)
export const authConfig = {
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { activeTenantId?: string | null; activeTenantName?: string | null };
        token.userId = user.id;
        token.activeTenantId = u.activeTenantId ?? null;
        token.activeTenantName = u.activeTenantName ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.activeTenantId = token.activeTenantId as string | null;
      session.user.activeTenantName = token.activeTenantName as string | null;
      return session;
    },
  },
  pages: { signIn: '/sign-in' },
} satisfies NextAuthConfig;
