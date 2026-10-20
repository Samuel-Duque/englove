# Stage 1: Base & Dependencies
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

# Stage 2: Dependencies builder
FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tooling/ ./tooling/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile || pnpm install

# Stage 3: Builder
FROM dependencies AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate prisma client and build shared & api
RUN pnpm --filter @englove/shared build
RUN pnpm --filter @englove/api db:generate
RUN pnpm --filter @englove/api build

# Stage 4: Production runner
FROM node:24-alpine AS runner
WORKDIR /app

# Install ffmpeg and ffprobe (Rule G-B07, Decision 64, RF-6)
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV PORT=3001

# Copy built application and required packages
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=dependencies /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3001

WORKDIR /app/apps/api
CMD ["node", "dist/src/main.js"]
