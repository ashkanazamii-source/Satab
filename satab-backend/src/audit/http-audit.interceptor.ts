import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { AuditTopic } from './audit-topics';
import { RequestContext } from '../common/request-context';

function mask(obj: any, keys: string[] = ['password', 'authorization', 'token', 'secret']) {
  try {
    const clone = JSON.parse(JSON.stringify(obj ?? {}));
    const walk = (o: any) => {
      if (!o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        if (keys.includes(k.toLowerCase())) o[k] = '***';
        else walk(o[k]);
      }
    };
    walk(clone);
    return clone;
  } catch { return undefined; }
}

@Injectable()
export class HttpAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    if (ctx.getType() !== 'http') return next.handle();
    const SLOW_MS = 800;

    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { user?: any }>();
    const res = http.getResponse<Response & { statusCode?: number }>();

    const started = Date.now();
    const { method, originalUrl: url } = req as any;

    const { userId, ip: ctxIp, userAgent: ctxUa } = RequestContext.get();
    const ip =
      ctxIp ??
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : (req as any).ip);
    const userAgent = ctxUa ?? (req.headers['user-agent'] as string | undefined);

    const actor = req.user
      ? { id: userId ?? req.user.id ?? null, name: req.user.full_name ?? null, role_level: req.user.role_level ?? null }
      : (userId ? { id: userId } : undefined);

    let errored = false;

    return next.handle().pipe(
      // خطاها رو اینجا لاگ نکن — میره تو GlobalExceptionFilter
      catchError((err) => {
        errored = true;
        return throwError(() => err);
      }),
      finalize(() => {
        if (errored) return;
        const duration = Date.now() - started;
        const status = res?.statusCode ?? 200;
        if (status >= 400) return;           // فقط موفق‌ها
        if (duration < SLOW_MS) return;      // فقط کندها

        void this.audit.log({
          topic: AuditTopic.HTTP_REQUEST,
          actor,
          message: `درخواست ${method} ${url} با وضعیت ${status} در ${duration}ms`,
          metadata: {
            query: mask((req as any).query),
            body: mask((req as any).body),
            duration_ms: duration,
          },
          ip,
          user_agent: userAgent,
        }).catch(() => {});
      }),
    );
  }
}
