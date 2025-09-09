import { Injectable } from '@nestjs/common';
import {
  DataSource, EntitySubscriberInterface,
  EventSubscriber, InsertEvent, UpdateEvent, RemoveEvent
} from 'typeorm';
import { AuditService } from './audit.service';
import { AuditTopic } from './audit-topics';
import { RequestContext } from '../common/request-context';

const AUDIT_ENTITY_ENABLED = process.env.AUDIT_ENTITY === '1';

function parseEntityId(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(private dataSource: DataSource, private audit: AuditService) {
    // فقط اگر روشن شده باشد، رجیستر کن
    if (AUDIT_ENTITY_ENABLED) {
      this.dataSource.subscribers.push(this);
    }
  }

  listenTo() { return Object; }

  async afterInsert(event: InsertEvent<any>) {
    if (!AUDIT_ENTITY_ENABLED) return; // خاموش
    const { userId, ip, userAgent } = RequestContext.get();
    const entityType = event.metadata.name;
    const rawId = (event.entity && (event.entity.id ?? event.entity.uuid)) ?? null;
    const entityId = parseEntityId(rawId);
    const entityLabel = rawId != null ? String(rawId) : null;

    await this.audit.log({
      topic: AuditTopic.ENTITY_INSERT,
      actor: userId ? { id: userId } : undefined,
      entity: { type: entityType, id: entityId, label: entityLabel },
      message: `INSERT ${entityType}${entityLabel ? `#${entityLabel}` : ''}`,
      metadata: { entity: entityType, id: rawId, values: event.entity },
      ip, user_agent: userAgent,
    }).catch(() => {});
  }

  async afterUpdate(event: UpdateEvent<any>) {
    if (!AUDIT_ENTITY_ENABLED) return; // خاموش
    const { userId, ip, userAgent } = RequestContext.get();
    const entityType = event.metadata.name;
    const rawId =
      (event.databaseEntity && ((event.databaseEntity as any).id ?? (event.databaseEntity as any).uuid)) ?? null;
    const entityId = parseEntityId(rawId);
    const entityLabel = rawId != null ? String(rawId) : null;

    const diff: Record<string, { from: any; to: any }> = {};
    if (event.databaseEntity && event.entity) {
      for (const col of event.metadata.columns) {
        const prop = col.propertyName as keyof any;
        const from = (event.databaseEntity as any)[prop];
        const to = (event.entity as any)[prop];
        if (from !== to) diff[prop as string] = { from, to };
      }
    }

    await this.audit.log({
      topic: AuditTopic.ENTITY_UPDATE,
      actor: userId ? { id: userId } : undefined,
      entity: { type: entityType, id: entityId, label: entityLabel },
      message: `UPDATE ${entityType}${entityLabel ? `#${entityLabel}` : ''}`,
      metadata: { entity: entityType, id: rawId, changed: Object.keys(diff), diff },
      ip, user_agent: userAgent,
    }).catch(() => {});
  }

  async afterRemove(event: RemoveEvent<any>) {
    if (!AUDIT_ENTITY_ENABLED) return; // خاموش
    const { userId, ip, userAgent } = RequestContext.get();
    const entityType = event.metadata.name;

    const rawId =
      (event.entityId as any)?.id ??
      (event.entity as any)?.id ??
      (event.entity as any)?.uuid ??
      null;

    const entityId = parseEntityId(rawId);
    const entityLabel = rawId != null ? String(rawId) : null;

    await this.audit.log({
      topic: AuditTopic.ENTITY_REMOVE,
      actor: userId ? { id: userId } : undefined,
      entity: { type: entityType, id: entityId, label: entityLabel },
      message: `DELETE ${entityType}${entityLabel ? `#${entityLabel}` : ''}`,
      metadata: { entity: entityType, id: rawId },
      ip, user_agent: userAgent,
    }).catch(() => {});
  }
}
