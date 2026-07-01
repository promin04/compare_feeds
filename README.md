# compare_feeds

Elysia (Bun) service that runs an in-process **cron worker** to fetch and compare
RSS/Atom feeds, plus an **HTTP API** to inspect results and trigger runs on demand.
API and worker run in a single process.

## Setup

```bash
bun install
cp .env.example .env   # edit FEED_URLS / COMPARE_CRON as needed
```

## Run

```bash
bun run dev     # watch mode
bun run start   # production
```

## Config (env)

| Var            | Default          | Description                                       |
| -------------- | ---------------- | ------------------------------------------------- |
| `PORT`         | `3000`           | HTTP port                                         |
| `COMPARE_CRON` | `0 */5 * * * *`  | Cron pattern (`sec min hour day month weekday`)   |
| `FEED_URLS`    | _(empty)_        | Comma-separated feed URLs to fetch and compare    |

## API

| Method | Path                   | Description                          |
| ------ | ---------------------- | ------------------------------------ |
| GET    | `/`                    | Service info + worker status         |
| GET    | `/api/health`          | Health check                         |
| GET    | `/api/results`         | Recent run results (newest first)    |
| GET    | `/api/results/latest`  | Most recent run                      |
| POST   | `/api/compare`         | Trigger a compare run immediately    |

## Structure

```
src/
  index.ts          # entry: Elysia server + cron worker (single process)
  config.ts         # env-based config
  store.ts          # in-memory result history (swap for a DB later)
  api/index.ts      # HTTP routes (/api)
  worker/
    index.ts        # cron schedule + run orchestration
    compare.ts      # feed fetch + parse + overlap logic (pure, testable)
```

Results are kept **in-memory** (last 50 runs). To persist, replace `src/store.ts`
with a DB-backed implementation — the API and worker depend only on its interface.
