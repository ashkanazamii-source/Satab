import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DriverRouteService } from './driver-route.service';
import { Users } from '../users/users.entity';

type RoleLevel = 1 | 2 | 3 | 4 | 5 | 6; // اگر enum داری جایگزینش کن

interface AuthedSocket extends Socket {
  data: {
    userId?: number;
    roleLevel?: RoleLevel;
  };
}

@WebSocketGateway({
  namespace: '/driver-routes',
  cors: { origin: '*', credentials: false },
})
export class DriverRouteGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // userId → Set<socketId>
  private userSockets = new Map<number, Set<string>>();
  // socketId → { userId, roleLevel }
  private socketIndex = new Map<string, { userId: number; roleLevel: RoleLevel }>();
  // Throttle: routeId → lastEmitAt
  private lastEmitAt = new Map<number, number>();

  constructor(private readonly service: DriverRouteService) {}

  /* ----------------------------- Auth & Rooms ----------------------------- */

  private parseAuthFromHandshake(sock: AuthedSocket) {
    const q = sock.handshake.query || {};
    const userId = Number(q.userId);
    const roleLevel = Number(q.roleLevel) as RoleLevel;

    if (!userId || Number.isNaN(userId) || !roleLevel) {
      throw new WsException('Auth query (userId, roleLevel) لازم است');
    }

    sock.data.userId = userId;
    sock.data.roleLevel = roleLevel;
  }

  private joinDefaultRooms(sock: AuthedSocket) {
    const userId = sock.data.userId!;
    const roleLevel = sock.data.roleLevel!;

    sock.join(`user:${userId}`); // اتاق اختصاصی کاربر

    if (roleLevel === 1) {
      sock.join('managers'); // همه مدیرکل‌ها در یک اتاق
    }
  }

  async handleConnection(@ConnectedSocket() client: AuthedSocket) {
    try {
      this.parseAuthFromHandshake(client);
      this.joinDefaultRooms(client);

      const userId = client.data.userId!;
      const roleLevel = client.data.roleLevel!;

      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);
      this.socketIndex.set(client.id, { userId, roleLevel });

      client.emit('hello', { ok: true, userId, roleLevel });
    } catch (e: any) {
      client.emit('error', { message: e?.message || 'AUTH_FAILED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthedSocket) {
    const rec = this.socketIndex.get(client.id);
    if (!rec) return;

    const { userId } = rec;
    this.socketIndex.delete(client.id);

    const set = this.userSockets.get(userId);
    if (set) {
      set.delete(client.id);
      if (set.size === 0) this.userSockets.delete(userId);
    }
  }

  /* ----------------------------- Helpers ----------------------------- */

  /** اولین SA در زنجیره‌ی والدین راننده */
  private async findSuperAdminForDriver(driverId: number): Promise<Users | null> {
    const driver = await this.service.getDriverWithParents(driverId);
    let current: Users | null = driver;
    while (current?.parent) {
      if (current.parent.role_level === 2) return current.parent;
      current = current.parent;
    }
    return null;
  }

  /** throttling ساده: هر routeId حداکثر هر 400ms یکبار ارسال شود */
  private canEmitRoute(routeId: number, periodMs = 400): boolean {
    const now = Date.now();
    const last = this.lastEmitAt.get(routeId) || 0;
    if (now - last >= periodMs) {
      this.lastEmitAt.set(routeId, now);
      return true;
    }
    return false;
  }

  /** آیا این کلاینت اجازه دارد روی این راننده عمل انجام دهد؟ */
  private async canActOnDriver(client: AuthedSocket, targetDriverId: number): Promise<boolean> {
    const meId = client.data.userId!;
    const role = client.data.roleLevel!;
    // خودِ راننده:
    if (role === 6) return meId === targetDriverId;
    // مدیرکل:
    if (role === 1) return true;
    // سوپرادمین: فقط روی زیرمجموعه خودش
    if (role === 2) {
      const drv = await this.service.getDriverWithParents(targetDriverId);
      let cur: Users | null = drv;
      while (cur?.parent) {
        if (cur.parent.id === meId && cur.parent.role_level === 2) return true;
        cur = cur.parent;
      }
      return false;
    }
    return false;
  }

  /* ----------------------------- Commands ----------------------------- */

  /** تماشای زنده مسیر راننده‌ی مشخص */
  @SubscribeMessage('watch_driver')
  async watchDriver(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { driverId: number },
  ) {
    const driverId = Number(body?.driverId);
    if (!driverId) throw new WsException('driverId نامعتبر');

    // محدودیت دسترسی
    const allowed = await this.canActOnDriver(client, driverId);
    if (!allowed) throw new WsException('FORBIDDEN');

    // راننده فقط اگر GPS براش فعال شده باشد
    if (client.data.roleLevel === 6) {
      const gpsOk = await this.service.driverHasOption(driverId, 'gps');
      if (!gpsOk) {
        client.emit('watch_result', { ok: false, reason: 'GPS_DISABLED_FOR_DRIVER' });
        return;
      }
    }

    const active = await this.service.getActiveRoute(driverId);
    if (!active) {
      client.emit('watch_result', { ok: false, reason: 'NO_ACTIVE_ROUTE' });
      return;
    }

    client.join(`route:${active.id}`);

    const points = active.gps_points || [];
    client.emit('route_history', {
      routeId: active.id,
      driverId,
      points: points.slice(-200),
      started_at: active.started_at,
    });

    client.emit('watch_result', { ok: true, routeId: active.id });
  }

  /** ترک‌کردن تماشای مسیر */
  @SubscribeMessage('unwatch_driver')
  async unwatchDriver(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { routeId: number },
  ) {
    const routeId = Number(body?.routeId);
    if (!routeId) throw new WsException('routeId نامعتبر');
    client.leave(`route:${routeId}`);
    client.emit('unwatch_result', { ok: true, routeId });
  }

  /** شروع مسیر (راننده/اپ) */
  @SubscribeMessage('start_route')
  async startRoute(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { driverId: number; vehicleId?: number | null },
  ) {
    const driverId = Number(body?.driverId);
    const vehicleId = body?.vehicleId ?? null;
    if (!driverId) throw new WsException('driverId نامعتبر');

    // محدودیت دسترسی
    const allowed = await this.canActOnDriver(client, driverId);
    if (!allowed) throw new WsException('FORBIDDEN');

    // راننده فقط اگر GPS براش فعال شده باشد
    if (client.data.roleLevel === 6) {
      const gpsOk = await this.service.driverHasOption(driverId, 'gps');
      if (!gpsOk) throw new WsException('GPS_DISABLED_FOR_DRIVER');
    }

    const route = await this.service.startRoute(driverId, vehicleId || undefined);
    client.join(`route:${route.id}`);

    const sa = await this.findSuperAdminForDriver(driverId);
    if (sa) this.server.to(`user:${sa.id}`).emit('route_started', { route });
    this.server.to('managers').emit('route_started', { route });

    client.emit('start_route_result', { ok: true, route });
  }

  /** پایان مسیر */
  @SubscribeMessage('finish_route')
  async finishRoute(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { routeId: number },
  ) {
    const routeId = Number(body?.routeId);
    if (!routeId) throw new WsException('routeId نامعتبر');

    // اول مسیر را بگیریم تا مالک (driver_id) مشخص شود
    const routeMeta = await this.service.getOne(routeId, { includePoints: false } as any);
    const allowed = await this.canActOnDriver(client, (routeMeta as any).driver_id);
    if (!allowed) throw new WsException('FORBIDDEN');

    const updated = await this.service.finishRoute(routeId);

    const driverId = updated.driver_id;
    const sa = await this.findSuperAdminForDriver(driverId);
    if (sa) this.server.to(`user:${sa.id}`).emit('route_finished', { route: updated });
    this.server.to('managers').emit('route_finished', { route: updated });
    this.server.to(`route:${routeId}`).emit('route_finished', { route: updated });

    client.emit('finish_route_result', { ok: true, route: updated });
  }

  /** موقعیت زنده راننده */
  @SubscribeMessage('driver_location')
  async handleLocation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { routeId: number; lat: number; lng: number; timestamp?: string },
  ) {
    const { routeId, lat, lng, timestamp } = data || {};
    if (!routeId || typeof lat !== 'number' || typeof lng !== 'number') {
      throw new WsException('payload نامعتبر');
    }

    // اطمینان از دسترسی روی همین route
    const routeMeta = await this.service.getOne(routeId, { includePoints: false } as any);
    const driverId = (routeMeta as any).driver_id;

    const allowed = await this.canActOnDriver(client, driverId);
    if (!allowed) throw new WsException('FORBIDDEN');

    // راننده فقط اگر GPS براش فعال شده باشد
    if (client.data.roleLevel === 6) {
      const gpsOk = await this.service.driverHasOption(driverId, 'gps');
      if (!gpsOk) throw new WsException('GPS_DISABLED_FOR_DRIVER');
    }

    const saved = await this.service.addPoint(routeId, { lat, lng, ts: timestamp });

    if (!this.canEmitRoute(routeId)) return;

    const payload = { routeId, driverId, lat, lng, ts: new Date().toISOString() };

    this.server.to(`route:${routeId}`).emit('driver_location_update', payload);
    const sa = await this.findSuperAdminForDriver(driverId);
    if (sa) this.server.to(`user:${sa.id}`).emit('driver_location_update', payload);
    this.server.to('managers').emit('driver_location_update', payload);
    this.server.to(`user:${driverId}`).emit('driver_location_update_self', payload);

    // اگر route به vehicle وصل است، تاپیک vehicle هم آپدیت
    if (saved.vehicle_id) {
      this.emitVehiclePos(saved.vehicle_id, lat, lng, payload.ts);
    }
  }

  /** اجازه بده کلاینت به Room دلخواه (topic) جوین/لیو کند */
  @SubscribeMessage('subscribe')
  onSubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { topic?: string }) {
    const topic = body?.topic?.trim();
    if (!topic) throw new WsException('topic لازم است');
    client.join(topic);
    client.emit('subscribed', { topic });
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { topic?: string }) {
    const topic = body?.topic?.trim();
    if (!topic) throw new WsException('topic لازم است');
    client.leave(topic);
    client.emit('unsubscribed', { topic });
  }

  /** کمک: انتشار رویدادهای مطابق قرارداد فرانت */
  private emitVehiclePos(vehicleId: number, lat: number, lng: number, ts?: string | number) {
    this.server.to(`vehicle/${vehicleId}/pos`).emit('vehicle:pos', {
      vehicle_id: vehicleId, lat, lng, ts: ts ?? Date.now()
    });
  }
  private emitIgnition(vehicleId: number, on: boolean) {
    this.server.to(`vehicle/${vehicleId}/ignition`).emit('vehicle:ignition', {
      vehicle_id: vehicleId, ignition: on
    });
  }
  private emitIdle(vehicleId: number, secs: number) {
    this.server.to(`vehicle/${vehicleId}/idle_time`).emit('vehicle:idle_time', {
      vehicle_id: vehicleId, idle_time: secs
    });
  }
  private emitOdo(vehicleId: number, km: number) {
    this.server.to(`vehicle/${vehicleId}/odometer`).emit('vehicle:odometer', {
      vehicle_id: vehicleId, odometer: km
    });
  }
}
