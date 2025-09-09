import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditTopic } from './audit-topics';
import { RequestContext } from '../common/request-context';

@Catch()
export class GlobalExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly audit: AuditService,
    private readonly adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const { userId, ip, userAgent } = RequestContext.get();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const rawMsg =
        exception instanceof HttpException
          ? (exception.getResponse() as any)?.message ?? exception.message
          : (exception as any)?.message ?? 'خطای داخلی';

      const msg = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg ?? '');

      const actor =
        userId || req?.user
          ? {
              id: userId ?? req?.user?.id ?? null,
              name: req?.user?.full_name ?? null,
              role_level: req?.user?.role_level ?? null,
            }
          : undefined;

      try {
        await this.audit.log({
          topic: AuditTopic.EXCEPTION,
          actor,
          message: `خطا در ${req?.method ?? ''} ${req?.originalUrl ?? req?.url ?? ''} با وضعیت ${status}: ${msg}`,
          metadata:
            process.env.NODE_ENV === 'production'
              ? { name: (exception as any)?.name }
              : {
                  name: (exception as any)?.name,
                  stack: (exception as any)?.stack?.split('\n').slice(0, 10).join('\n'),
                },
          ip,
          user_agent: userAgent,
        });
      } catch { /* ignore */ }
    }

    return super.catch(exception, host);
  }
}
