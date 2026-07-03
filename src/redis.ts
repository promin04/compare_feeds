import { RedisClient } from "bun";
import { config } from "./config.ts";

/**
 * Shared Redis client — or `null` when REDIS_URL is not configured, so the app
 * still boots and runs locally without Redis. Bun ships a Redis client built
 * in, so no external dependency is needed.
 */
export const redis = config.redisUrl
  ? new RedisClient(config.redisUrl, { connectionTimeout: 5_000 })
  : null;

/**
 * Attaches connection logging and eagerly connects at startup, so a
 * successful (or failed) connection is reported instead of staying silent
 * until the first command. No-op when Redis is not configured.
 */
export function initRedis(): void {
  if (!redis) {
    console.log("[redis] not configured (REDIS_URL unset) — skipping");
    return;
  }
  redis.onconnect = () => console.log("[redis] connected ✅");
  redis.onclose = (err) =>
    console.warn(`[redis] connection closed: ${err?.message ?? "unknown"}`);

  // Explicit bounded connectivity check so BOTH success and failure are logged
  // at startup (connect() alone can stay silent while auto-reconnect retries).
  void redisPing().then((r) => {
    if (r.ok) console.log(`[redis] startup ping ok (${r.detail})`);
    else console.error(`[redis] startup ping failed: ${r.detail}`);
  });
}

/**
 * Pings Redis with a bounded timeout so a slow/dead connection can never hang
 * a caller (e.g. the health endpoint). Returns a plain status object.
 */
export async function redisPing(
  timeoutMs = 2_000,
): Promise<{ ok: boolean; detail: string }> {
  if (!redis) return { ok: false, detail: "REDIS_URL not set" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("ping timeout")), timeoutMs);
  });

  try {
    if (!redis.connected) await Promise.race([redis.connect(), timeout]);
    const pong = await Promise.race([redis.send("PING", []), timeout]);
    return { ok: true, detail: String(pong) };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
