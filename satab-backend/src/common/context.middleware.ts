// context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  use(req: Request & { user?: any }, _res: Response, next: NextFunction) {
    const fwd = req.headers['x-forwarded-for'];
    const ipHdr = Array.isArray(fwd) ? fwd[0] : (fwd as string | undefined);
    const ip = ipHdr?.split(',')[0]?.trim() || (req.ip as string);
    const userAgent = (req.headers['user-agent'] as string) || undefined;

    const userId = req.user?.id ?? null;
    const actorName = req.user?.full_name ?? null;
    const actorRole = req.user?.role_level ?? null;

    RequestContext.run({ userId, actorName, actorRole, ip, userAgent }, () => next());
  }
}
