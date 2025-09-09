import { AuditTopic } from './audit-topics';

const roleFa = (lvl?: number | null) =>
  ({1:'مدیرکل',2:'سوپرادمین',3:'مدیر شعبه',4:'مالک',5:'تکنسین',6:'راننده'} as const)[lvl ?? -1] ?? 'نامشخص';

export function humanizeAuditRow(row: any, tz = 'Asia/Qatar') {
  const t = new Date(row.created_at).toLocaleString('fa-IR', { timeZone: tz });

  // اگر پیام قبلاً ساخته شده، همون رو بده
  if (row.message) return row.message;

  // ✅ اولویت با اسنپ‌شات؛ بعد جوین لایو؛ بعد fallback
  const actorName = row.actor_name_snapshot ?? row.actor?.full_name ?? 'سیستم';
  const actorRole = roleFa(row.actor_role_level_snapshot ?? row.actor?.role_level ?? null);

  const subjName =
    row.target_name_snapshot ??
    row.target?.full_name ??
    row.target_user?.full_name ??
    (row.target_user_id != null ? `کاربر #${row.target_user_id}` : 'کاربر نامشخص');

  const subjRole = roleFa(
    row.target_role_level_snapshot ??
    row.target?.role_level ??
    row.target_user?.role_level ??
    null
  );

  switch (row.topic) {
    case AuditTopic.USER_CREATE:
      return `${actorName} (نقش: ${actorRole}) کاربر ${subjName} (نقش: ${subjRole}) را در ${t} ایجاد کرد.`;
    case AuditTopic.USER_DELETE:
      return `${actorName} (نقش: ${actorRole}) کاربر ${subjName} (نقش: ${subjRole}) را در ${t} حذف کرد.`;
    case AuditTopic.USER_CHANGE_ROLE: {
      const before = row.metadata?.before_role;
      const after = row.metadata?.after_role;
      return `${actorName} نقش ${subjName} را در ${t} از «${roleFa(before)}» به «${roleFa(after)}» تغییر داد.`;
    }
    case AuditTopic.USER_UPDATE:
      return `${actorName} اطلاعات ${subjName} را در ${t} ویرایش کرد.`;
    default:
      return `${actorName} رویداد ${row.topic} را در ${t} انجام داد.`;
  }
}
