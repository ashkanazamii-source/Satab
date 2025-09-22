import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGINS?.split(',').map(s=>s.trim()) || true },
  transports: ['websocket', 'polling'],
  namespace: '/', // همان روت اصلی
})
export class BoardGateway {
  @WebSocketServer() server!: Server;

  publish(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }

  // اختیاری: برای تست دستی
  @SubscribeMessage('ping')
  onPing(@MessageBody() m: any) {
    this.server.emit('pong', { ok: true, m, ts: Date.now() });
  }
}
