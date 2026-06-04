/**
 * In-memory login throttle (per key, usually client IP). After `maxAttempts`
 * failures it blocks with exponential backoff. Bounded so a rotating-IP attacker
 * can't grow the map without limit. A single shared instance password is a juicy
 * brute-force target, so this matters even for a homelab exposed to the internet.
 */
export interface ThrottleOptions {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  maxEntries: number;
  now: () => number;
}

const DEFAULTS: ThrottleOptions = {
  maxAttempts: 5,
  baseBackoffMs: 1_000,
  maxBackoffMs: 15 * 60_000,
  maxEntries: 10_000,
  now: Date.now,
};

interface Entry {
  count: number;
  blockedUntil: number;
  seen: number;
}

export interface LoginThrottle {
  check(key: string): { allowed: boolean; retryAfterMs: number };
  fail(key: string): void;
  succeed(key: string): void;
}

export function createLoginThrottle(opts: Partial<ThrottleOptions> = {}): LoginThrottle {
  const cfg = { ...DEFAULTS, ...opts };
  const entries = new Map<string, Entry>();

  const evictIfNeeded = () => {
    if (entries.size < cfg.maxEntries) return;
    // Drop the least-recently-seen entries.
    const sorted = [...entries.entries()].sort((a, b) => a[1].seen - b[1].seen);
    for (let i = 0; i < Math.ceil(cfg.maxEntries / 10) && i < sorted.length; i++) {
      const entry = sorted[i];
      if (entry) entries.delete(entry[0]);
    }
  };

  return {
    check(key) {
      const now = cfg.now();
      const e = entries.get(key);
      if (e && e.blockedUntil > now) return { allowed: false, retryAfterMs: e.blockedUntil - now };
      return { allowed: true, retryAfterMs: 0 };
    },
    fail(key) {
      const now = cfg.now();
      evictIfNeeded();
      const e = entries.get(key) ?? { count: 0, blockedUntil: 0, seen: now };
      e.count += 1;
      e.seen = now;
      if (e.count >= cfg.maxAttempts) {
        const backoff = Math.min(cfg.maxBackoffMs, cfg.baseBackoffMs * 2 ** (e.count - cfg.maxAttempts));
        e.blockedUntil = now + backoff;
      }
      entries.set(key, e);
    },
    succeed(key) {
      entries.delete(key);
    },
  };
}
