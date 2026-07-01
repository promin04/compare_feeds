# Pin the same Bun version used in development.
FROM oven/bun:1.3.5-alpine AS base
WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# App source (Bun runs TypeScript directly — no build step).
COPY . .

ENV NODE_ENV=production
# Railway injects PORT at runtime; this is only documentation for local use.
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
