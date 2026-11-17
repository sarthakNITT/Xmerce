import { RedisClient } from "bun";
import { appConfig } from "../config/app";

/**
 * Tiny key/value cache. Uses Redis when REDIS_URL is set (shared across server
 * instances), otherwise an in-process Map with TTL. Cache errors never fail a
 * request: they are treated as a miss.
 */
interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
}

class MemoryCache implements Cache {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private readonly maxEntries = 5000;

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    if (this.store.size >= this.maxEntries) {
      // Drop the oldest entry (Map keeps insertion order).
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async incr(key: string) {
    const current = Number((await this.get(key)) ?? 0) + 1;
    this.store.set(key, { value: String(current), expiresAt: Number.MAX_SAFE_INTEGER });
    return current;
  }
}

class RedisCache implements Cache {
  constructor(private client: RedisClient) {}

  async get(key: string) {
    return (await this.client.get(key)) ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.send("SET", [key, value, "EX", String(ttlSeconds)]);
  }

  async incr(key: string) {
    return await this.client.incr(key);
  }
}

const backend: Cache = appConfig.redisUrl ? new RedisCache(new RedisClient(appConfig.redisUrl)) : new MemoryCache();
export const cacheKind = appConfig.redisUrl ? "redis" : "memory";

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await backend.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      console.warn("[cache] get failed:", (err as Error).message);
      return null;
    }
  },
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await backend.set(key, JSON.stringify(value), ttlSeconds);
    } catch (err) {
      console.warn("[cache] set failed:", (err as Error).message);
    }
  },
  async getRaw(key: string): Promise<string | null> {
    try {
      return await backend.get(key);
    } catch {
      return null;
    }
  },
  async incr(key: string): Promise<number | null> {
    try {
      return await backend.incr(key);
    } catch (err) {
      console.warn("[cache] incr failed:", (err as Error).message);
      return null;
    }
  },
};
