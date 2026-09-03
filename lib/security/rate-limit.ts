/**
 * Rate limiting en memoria (ventana fija). Es por instancia serverless, no
 * global — suficiente como mitigación de abuso para el MVP. Para límites
 * estrictos y compartidos, cambiar a Upstash/Redis.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export type RateResult = { ok: boolean; retryAfter?: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateResult {
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (limit < 1) return { ok: false, retryAfter: Math.ceil(windowMs / 1000) };
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}
