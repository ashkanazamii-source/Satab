// driver-routes.ingest.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsISO8601 } from 'class-validator';
import { DriverRouteService } from './driver-route.service';

// DTO برای ورودی POS
class IngestPosDto {
  @Type(() => Number) @IsNumber()
  routeId!: number;

  @Type(() => Number) @IsNumber()
  lat!: number;

  @Type(() => Number) @IsNumber()
  lng!: number;

  @IsOptional() @IsISO8601()
  ts?: string;
}

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('driver-routes/ingest')
export class DriverRouteIngestController {
  constructor(private readonly service: DriverRouteService) {}

  @Post('pos')
  async ingestPos(@Body() body: IngestPosDto) {
    const { routeId, lat, lng, ts } = body;

    // addPoint الان خودش با قفل/ترنزاکشن و فیلتر نویز مسافت رو دقیق و اتمیک آپدیت می‌کنه
    const saved = await this.service.addPoint(routeId, { lat, lng, ts });
    if (!saved) {
      throw new BadRequestException('ذخیره‌سازی نقطه انجام نشد');
    }

    // نکته: همین حالا داخل addPoint → this.gateway.broadcastLocationUpdate(saved) صدا زده می‌شود
    // و WS به تمام مخاطبین مربوطه ارسال می‌شود. نیازی به تکرار در کنترلر نیست.

    return {
      ok: true,
      routeId: saved.id,
      driverId: saved.driver_id,
      lastPointTs: saved.last_point_ts,
      totalDistanceKm: saved.total_distance_km,
      pointsCount: saved.points_count,
    };
  }
}
