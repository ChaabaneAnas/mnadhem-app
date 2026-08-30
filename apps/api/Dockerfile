FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2.10.0
COPY . .
RUN turbo prune api --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npx turbo run build --filter=api...
RUN npm prune --omit=dev

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app .
RUN chmod +x ./apps/api/docker-entrypoint.sh
USER nestjs
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["./apps/api/docker-entrypoint.sh"]
