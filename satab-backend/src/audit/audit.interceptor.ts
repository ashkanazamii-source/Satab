import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AUDIT_META, AuditMeta } from './audit.decorator';
import { AuditService } from './audit.service';
import { RequestContext } from '../common/request-context';

function getByPath(obj: any, path?: string) {
  if (!path) return undefined;
  try { return path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj); }
  catch { return undefined; }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_META, ctx.getHandler());
    if (!meta) return next.handle();

    const http = ctx.switchToHttp();
    const req: any = http.getRequest();

    const { ip: ipCtx, userAgent: uaCtx, userId: ctxUserId, actorName: ctxActorName, actorRole: ctxActorRole } = RequestContext.get();

    // actor از req.user یا از کانتکست
    const actor = (req.user || ctxUserId)
      ? {
          id: req.user?.id ?? ctxUserId ?? null,
          name: req.user?.full_name ?? ctxActorName ?? null,
          role_level: req.user?.role_level ?? ctxActorRole ?? null,
        }
      : undefined;

    // اگر actor نداریم، لاگ نکن (نویز صفر)
    if (!actor || actor.id == null) {
      return next.handle();
    }

    const targetIdRaw = getByPath(req, meta.targetPath);
    const target = targetIdRaw != null ? { id: Number(targetIdRaw) } : undefined;

    const ip = ipCtx ?? (req.headers?.['x-forwarded-for']?.split?.(',')[0]?.trim?.() || req.ip);
    const user_agent = uaCtx ?? req.headers?.['user-agent'];

    const base = {
      topic: meta.topic,
      message: meta.message,
      actor,
      target,
      ip,
      user_agent,
    } as const;

    const successOnly = meta.successOnly !== false;

    if (successOnly) {
      return next.handle().pipe(
        tap(() => { this.audit.log({ ...base }); }),
      );
    }

    return next.handle().pipe(
      tap(() => { this.audit.log({ ...base }); }),
      catchError(err => {
        this.audit.log({
          ...base,
          metadata: { error: { name: err?.name, message: err?.message } },
        });
        return throwError(() => err);
      }),
    );
  }
}
