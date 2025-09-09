// request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

type Ctx = {
  userId?: number | null;
  actorName?: string | null;
  actorRole?: number | null;
  ip?: string | null;
  userAgent?: string | null;
};

export class RequestContext {
  private static als = new AsyncLocalStorage<Ctx>();
  static run(ctx: Ctx, fn: () => void) { this.als.run(ctx, fn); }
  static get(): Ctx { return this.als.getStore() ?? {}; }
}
