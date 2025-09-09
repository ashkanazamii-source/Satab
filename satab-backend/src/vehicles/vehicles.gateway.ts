// vehicles.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type TopicKind = 'pos' | 'ignition' | 'idle_time' | 'odometer' | 'stations';

@WebSocketGateway({ namespace: '/vehicles', cors: { origin: '*', credentials: false } })
export class VehiclesGateway {
  @WebSocketServer() server: Server;

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
  emitVehiclePos(vehicleId: number, lat: number, lng: number, ts: string) {
    const payload = { vehicle_id: vehicleId, lat, lng, ts };
    this.server.to(`vpos:${vehicleId}`).emit('vehicle:pos', payload);
  }

  emitIgnition(vehicleId: number, ignition: boolean, ts?: string) {
    this.server
      .to(`vign:${vehicleId}`)
      .emit('vehicle:ignition', {
        vehicle_id: vehicleId,
        ignition,
        ts: ts ?? new Date().toISOString(),
      });
  }

  emitIdle(vehicleId: number, idle_time: number, ts?: string) {
    this.server
      .to(`vidle:${vehicleId}`)
      .emit('vehicle:idle_time', {
        vehicle_id: vehicleId,
        idle_time,
        ts: ts ?? new Date().toISOString(),
      });
  }

  emitOdometer(vehicleId: number, odometer: number, ts?: string) {
    this.server
      .to(`vodo:${vehicleId}`)
      .emit('vehicle:odometer', {
        vehicle_id: vehicleId,
        odometer,
        ts: ts ?? new Date().toISOString(),
      });
  }

  /**
   * ایستگاه‌ها را هم به اتاق عمومی همان وسیله و هم به اتاق خصوصیِ owner می‌فرستد.
   * - عمومی:  vst:<vid>
   * - خصوصی: vst:<vid>:<ownerUserId>
   */
  emitStationsChanged(vehicleId: number, ownerUserId: number, payload: any) {
    const msg = { vehicle_id: vehicleId, ...payload };
    // per-owner
    this.server.to(`vst:${vehicleId}:${ownerUserId}`).emit('vehicle:stations', msg);
    // public (برای همه مشترکین همان vehicle)
    this.server.to(`vst:${vehicleId}`).emit('vehicle:stations', msg);
  }

  // ---------------- Helpers ----------------
  /**
   * پشتیبانی از هر دو الگو:
   *  - با uid:    vehicle/<vid>/<kind>/<uid>  (stations خصوصی، سایر kindها عمومی)
   *  - عمومی:     vehicle/<vid>/<kind>
   *  - عمومیِ ایستگاه‌ها: vehicle/<vid>/stations
   */
  private topicToRoom(topic?: string): string | null {
    if (!topic) return null;

    // الگوی با uid (خصوصاً برای stations خصوصی)
    let m = topic.match(/^vehicle\/(\d+)\/(pos|ignition|idle_time|odometer|stations)\/(\d+)$/);
    if (m) {
      const [, vid, kind, uid] = m;
      switch (kind as TopicKind) {
        case 'pos':       return `vpos:${vid}`;           // pos عمومی
        case 'ignition':  return `vign:${vid}`;           // ignition عمومی
        case 'idle_time': return `vidle:${vid}`;          // idle_time عمومی
        case 'odometer':  return `vodo:${vid}`;           // odometer عمومی
        case 'stations':  return `vst:${vid}:${uid}`;     // stations خصوصی
      }
    }

    // الگوی عمومیِ بدون uid برای سایر kindها
    m = topic.match(/^vehicle\/(\d+)\/(pos|ignition|idle_time|odometer)$/);
    if (m) {
      const [, vid, kind] = m;
      switch (kind as TopicKind) {
        case 'pos':       return `vpos:${vid}`;
        case 'ignition':  return `vign:${vid}`;
        case 'idle_time': return `vidle:${vid}`;
        case 'odometer':  return `vodo:${vid}`;
      }
    }

    // الگوی عمومیِ ایستگاه‌ها بدون uid
    m = topic.match(/^vehicle\/(\d+)\/stations$/);
    if (m) {
      const [, vid] = m;
      return `vst:${vid}`;
    }

    return null;
  }
}
