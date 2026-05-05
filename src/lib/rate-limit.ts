type LimitKey = "chat" | "upload" | "chunks";

type LimitConfig = {
  windowMs: number;
  max: number;
};

const LIMITS: Record<LimitKey, LimitConfig> = {
  chat: { windowMs: 10 * 60_000, max: 30 },
  upload: { windowMs: 60 * 60_000, max: 10 },
  chunks: { windowMs: 10 * 60_000, max: 120 },
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  key: LimitKey,
  userId: string | null,
  ip: string | null,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const cfg = LIMITS[key];
  const id = userId ?? `ip:${ip ?? "unknown"}`;
  const bucketKey = `${key}:${id}`;
  const now = Date.now();

  let bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + cfg.windowMs };
  }

  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  return {
    allowed: bucket.count <= cfg.max,
    remaining: Math.max(0, cfg.max - bucket.count),
    resetAt: bucket.resetAt,
  };
}
