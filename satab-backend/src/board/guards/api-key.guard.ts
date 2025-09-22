import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const k = req.headers['x-api-key'] || req.query['api_key'];
    const list = (process.env.BOARD_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!list.length) return true; // اگر کلید تعریف نکردی، باز بگذار برای dev
    if (!k || !list.includes(String(k))) throw new UnauthorizedException('bad api key');
    return true;
  }
}
