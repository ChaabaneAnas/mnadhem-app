import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@mnadhem/database';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const firstMembership = await prisma.tenantMember.findFirst({
          where: { userId: user.id },
          include: { tenant: { select: { id: true, name: true } } },
          orderBy: { joinedAt: 'asc' },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          locale: user.locale,
          activeTenantId: firstMembership?.tenantId ?? null,
          activeTenantName: firstMembership?.tenant?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in: populate from the authorize() return value
      if (user) {
        const u = user as {
          activeTenantId?: string | null;
          activeTenantName?: string | null;
          locale?: string | null;
        };
        token.userId = user.id;
        token.activeTenantId = u.activeTenantId ?? null;
        token.activeTenantName = u.activeTenantName ?? null;
        token.locale = u.locale ?? null;
      }
      // Self-healing: if the token has a user but no tenant, re-check the DB.
      // This fires once after onboarding creates the first tenant, then caches
      // the result in the JWT so subsequent requests never hit the DB.
      if (token.userId && !token.activeTenantId) {
        const membership = await prisma.tenantMember.findFirst({
          where: { userId: token.userId as string },
          include: { tenant: { select: { id: true, name: true } } },
          orderBy: { joinedAt: 'asc' },
        });
        if (membership) {
          token.activeTenantId = membership.tenantId;
          token.activeTenantName = membership.tenant.name;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.activeTenantId = token.activeTenantId as string | null;
      session.user.activeTenantName = token.activeTenantName as string | null;
      session.user.locale = token.locale as string | null;
      return session;
    },
  },
});
