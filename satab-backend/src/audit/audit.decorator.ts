// src/audit/audit.decorator.ts
import { SetMetadata, applyDecorators, UseInterceptors } from '@nestjs/common';
import { AuditTopic } from './audit-topics';
import { AuditInterceptor } from './audit.interceptor';

export const AUDIT_META = 'AUDIT_META';

export type AuditMeta = {
  /**
   * موضوع/تاپیک لاگ (مثل: 'USER_UPDATE', 'VEHICLE_CREATE', ...)
   */
  topic: AuditTopic;

  /**
   * پیام ثابت (اختیاری)
   */
  message?: string;

  /**
   * مسیرِ استخراج target_user_id از req (اختیاری)
   * مثال‌ها: 'params.userId' | 'body.user_id' | 'query.uid'
   */
  targetPath?: string;

  /**
   * فقط در موفقیت لاگ شود؟ (پیش‌فرض: true)
   * اگر false باشد، در خطا هم لاگ می‌کنیم.
   */
  successOnly?: boolean;
};

/**
 * اگر AuditInterceptor را به صورت APP_INTERCEPTOR در ماژول ثبت کرده‌اید
 * همین دکوراتور کافی است (فقط متادیتا را ست می‌کند).
 */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META, meta);

/**
 * اگر نمی‌خواهید اینترسپتور را global کنید،
 * از این دکوراتور لوکال استفاده کنید تا هم متادیتا ست شود و هم اینترسپتور اعمال گردد.
 */
export const AuditLocal = (meta: AuditMeta) =>
  applyDecorators(SetMetadata(AUDIT_META, meta), UseInterceptors(AuditInterceptor));
