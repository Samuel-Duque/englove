# Stage 1: Base & Dependencies
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

# Stage 2: Dependencies builder
FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tooling/ ./tooling/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma/ ./apps/api/prisma/
COPY apps/api/prisma.config.ts ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Stage 3: Builder
FROM dependencies AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate prisma client and build shared & api
RUN pnpm --filter @englove/shared build
RUN pnpm --filter @englove/api db:generate
RUN pnpm --filter @englove/api build
RUN pnpm --filter @englove/api deploy --prod --legacy --offline --ignore-scripts /out/api
# Prisma genera fuera del paquete @prisma/client; conservar ese artefacto en el despliegue aislado.
RUN cd apps/api && node -e "const fs = require('node:fs'); const path = require('node:path'); const generated = path.resolve(path.dirname(require.resolve('@prisma/client/package.json')), '../../.prisma'); const deployed = path.resolve(path.dirname(require.resolve('@prisma/client/package.json', { paths: ['/out/api'] })), '../../.prisma'); fs.cpSync(generated, deployed, { recursive: true });"

# Stage 4: Production runner
FROM node:24-alpine AS runner
WORKDIR /app

# Install ffmpeg and ffprobe (Rule G-B07, Decision 64, RF-6)
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV PORT=3001
ENV NODE_OPTIONS="--max-old-space-size=320"

# Copy built application and required packages
COPY --chown=node:node --from=builder /out/api/ ./

USER node

EXPOSE 3001

CMD ["node", "dist/src/main.js"]
