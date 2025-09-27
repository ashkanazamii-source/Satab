import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type TopicKind = 'pos' | 'ignition' | 'idle_time' | 'odometer' | 'stations' | 'geofence';

type PosPayload = {
  vehicle_id: number;
  lat: number;
  lng: number;
  ts: string;
  inside?: boolean;
  speed?: number;
  heading?: number;
  serverTs?: string;
};
type IgnPayload = { vehicle_id: number; ignition: boolean; ts: string };
type IdlePayload = { vehicle_id: number; idle_time: number; ts: string };
type OdoPayload = { vehicle_id: number; odometer: number; ts: string };
type GeoPayload = { vehicle_id: number; lat: number; lng: number; ts: string };

@WebSocketGateway({ namespace: '/vehicles', cors: { origin: '*', credentials: false } })
export class VehiclesGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('subscribe')
  onSubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { topic: string }) {
    const room = this.topicToRoom(body?.topic);
    if (!room) {
      client.emit('error', { topic: body?.topic, error: 'invalid_topic' });
      return;
    }
    client.join(room);
    client.emit('subscribed', { topic: body.topic });
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { topic: string }) {
    const room = this.topicToRoom(body?.topic);
    if (!room) {
      client.emit('error', { topic: body?.topic, error: 'invalid_topic' });
      return;
    }
    client.leave(room);
    client.emit('unsubscribed', { topic: body.topic });
  }

  // ---------------- Emitters ----------------
  emitVehiclePos(
    vehicleId: number,
    lat: number,
    lng: number,
    ts: string,
    extra?: { speed?: number; heading?: number; serverTs?: string; inside?: boolean },
  ) {
    const payload: PosPayload = {
      vehicle_id: vehicleId,
      lat,
      lng,
      ts,
      inside: extra?.inside,
      speed: typeof extra?.speed === 'number' ? extra.speed : undefined,
      heading: typeof extra?.heading === 'number' ? extra.heading : undefined,
      serverTs: extra?.serverTs,
    };
    this.server.to(`vpos:${vehicleId}`).emit('vehicle:pos', payload);
  }

  emitIgnition(vehicleId: number, ignition: boolean, ts?: string) {
    const payload: IgnPayload = {
      vehicle_id: vehicleId,
      ignition,
      ts: ts ?? new Date().toISOString(),
    };
    this.server.to(`vign:${vehicleId}`).emit('vehicle:ignition', payload);
  }

  emitIdle(vehicleId: number, idle_time: number, ts?: string) {
    const payload: IdlePayload = {
      vehicle_id: vehicleId,
      idle_time,
      ts: ts ?? new Date().toISOString(),
    };
    this.server.to(`vidle:${vehicleId}`).emit('vehicle:idle_time', payload);
  }

  emitOdometer(vehicleId: number, odometer: number, ts?: string) {
    const payload: OdoPayload = {
      vehicle_id: vehicleId,
      odometer,
      ts: ts ?? new Date().toISOString(),
    };
    this.server.to(`vodo:${vehicleId}`).emit('vehicle:odometer', payload);
  }

  // ✅ پیاده‌سازی واقعی
  emitGeofenceViolation(vehicleId: number, payload: { vehicleId: number; lat: number; lng: number; ts: string }) {
    const msg: GeoPayload = {
      vehicle_id: payload.vehicleId,
      lat: payload.lat,
      lng: payload.lng,
      ts: payload.ts,
    };
    // روم اختصاصی برای رویدادهای ژئوفنس
    this.server.to(`vgeo:${vehicleId}`).emit('vehicle:geofence_violation', msg);
  }

  emitStationsChanged(vehicleId: number, ownerUserId: number, payload: any) {
    const msg = { vehicle_id: vehicleId, ...payload };
    this.server.to(`vst:${vehicleId}:${ownerUserId}`).emit('vehicle:stations', msg);
    this.server.to(`vst:${vehicleId}`).emit('vehicle:stations', msg);
  }

  // ---------------- Helpers ----------------
  private topicToRoom(topic?: string): string | null {
    if (!topic) return null;

    // با uid (خصوصی—بیشتر برای stations)
    let m = topic.match(/^vehicle\/(\d+)\/(pos|ignition|idle_time|odometer|stations|geofence)\/(\d+)$/);
    if (m) {
      const [, vid, kind, uid] = m;
      switch (kind as TopicKind) {
        case 'pos':       return `vpos:${vid}`;
        case 'ignition':  return `vign:${vid}`;
        case 'idle_time': return `vidle:${vid}`;
        case 'odometer':  return `vodo:${vid}`;
        case 'stations':  return `vst:${vid}:${uid}`;
        case 'geofence':  return `vgeo:${vid}`; // geofence عمومی؛ uid را نادیده می‌گیریم
      }
    }

    // عمومی بدون uid
    m = topic.match(/^vehicle\/(\d+)\/(pos|ignition|idle_time|odometer|geofence)$/);
    if (m) {
      const [, vid, kind] = m;
      switch (kind as TopicKind) {
        case 'pos':       return `vpos:${vid}`;
        case 'ignition':  return `vign:${vid}`;
        case 'idle_time': return `vidle:${vid}`;
        case 'odometer':  return `vodo:${vid}`;
        case 'geofence':  return `vgeo:${vid}`;
      }
    }

    // stations عمومی
    m = topic.match(/^vehicle\/(\d+)\/stations$/);
    if (m) {
      const [, vid] = m;
      return `vst:${vid}`;
    }

    return null;
  }
}
