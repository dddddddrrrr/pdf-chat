###
# Multi-stage Dockerfile for the PDF Chat app.
# Targets Node 22 alpine; produces a standalone Next.js server bundle
# at /app + a runtime that pushes the schema and starts the server.
###

# ------- deps -------
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ------- builder -------
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Skip env validation at build time — real values arrive at runtime.
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ------- runner -------
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Default DB and upload paths point at the mounted volume.
ENV DATABASE_URL=file:/app/data/db.sqlite
ENV UPLOAD_DIR=/app/data/uploads

# Standalone Next.js output + static assets + drizzle bits for db:push.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/server/db ./src/server/db
COPY --from=builder /app/src/env.js ./src/env.js
COPY --from=builder /app/package.json ./package.json

# Migration + start. db:push is idempotent — safe to re-run on every container start.
RUN mkdir -p /app/data/uploads
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:push && node server.js"]
