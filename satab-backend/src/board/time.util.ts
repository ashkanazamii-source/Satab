// src/ingest/time.util.ts
export type TsFencePolicy = 'reject' | 'clamp';

export function normalizeTsWithFence(inputTs: number, nowMs: number, skewMs: number, policy: TsFencePolicy) {
  // sec → ms
  let tsMs = Number(inputTs);
  tsMs = tsMs >= 1e12 ? tsMs : tsMs * 1000;

  const min = nowMs - skewMs;
  const max = nowMs + skewMs;

  if (tsMs < min || tsMs > max) {
    if (policy === 'reject') return { ok: false as const, tsMs, reason: 'out_of_fence' as const };
    // clamp
    tsMs = tsMs < min ? min : max;
    return { ok: true as const, tsMs, clamped: true };
  }
  return { ok: true as const, tsMs, clamped: false };
}
