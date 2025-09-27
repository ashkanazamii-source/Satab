// src/drivers/driver-route.controller.ts
import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsEnum, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { DriverRouteService } from './driver-route.service';
import { DriverRouteStatus } from './driver-route.entity';

/* -------------------- DTOs -------------------- */
class MissionCountQueryDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
class StartRouteDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  vehicleId?: number;
}
class AddPointDto {
  @Type(() => Number) @IsNumber() lat!: number;
  @Type(() => Number) @IsNumber() lng!: number;
  @IsOptional() @IsISO8601() ts?: string;
}
class ListQueryDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsEnum(DriverRouteStatus) status?: DriverRouteStatus;
  @Type(() => Number) @IsOptional() @IsNumber() page?: number;
  @Type(() => Number) @IsOptional() @IsNumber() limit?: number;
}
class StatsQueryDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
class GetOneQueryDto {
  @IsOptional() includePoints?: 'true' | 'false';
}
class LastPointsQueryDto {
  @Type(() => Number) @IsOptional() @IsNumber()
  n?: number; // پیش‌فرض 200
}

/** بدنهٔ تله‌متری – آزاد/گسترده؛ نرمال‌سازی در سرویس انجام می‌شود */
type TelemetryMsg = {
  ts?: string | number | Date;
  ignition?: boolean;
  idle_time?: number | string | null;
  odometer?: number | string | null;
  engine_temp?: number | string | null;
  engine_on_duration?: number | string | null;
  distance_m?: number | string | null;
  mission_count?: number | string | null;
  lat?: number | string;
  lng?: number | string;
  [k: string]: any;
};

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('driver-routes')
export class DriverRouteController {
  constructor(private readonly service: DriverRouteService) {}

  /* ----------- Routes lifecycle ----------- */
  @Post('start/:driverId')
  startRoute(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() body: StartRouteDto,
  ) {
    return this.service.startRoute(driverId, body.vehicleId);
  }

  @Post('add-point/:routeId')
  addPoint(
    @Param('routeId', ParseIntPipe) routeId: number,
    @Body() body: AddPointDto,
  ) {
    return this.service.addPoint(routeId, { lat: body.lat, lng: body.lng, ts: body.ts });
  }

  @Post('finish/:routeId')
  finishRoute(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.service.finishRoute(routeId);
  }

  /* ----------- Queries / stats ----------- */
  @Get('missions/count/:driverId')
  getMissionCount(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Query() q: MissionCountQueryDto,
  ) {
    return this.service.getMissionCount(driverId, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }

  /** لیست مسیرهای یک راننده + فیلتر زمانی/وضعیت + صفحه‌بندی */
  @Get('by-driver/:driverId')
  getRoutes(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Query() q: ListQueryDto,
  ) {
    return this.service.getRoutesByDriver(driverId, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      status: q.status,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @Get('stats/:driverId')
  getDriverStats(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Query() q: StatsQueryDto,
  ) {
    return this.service.getRoutesWithStats(driverId, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }

  /** آخرین n نقطه‌ی یک مسیر (پیش‌فرض 200) */
  @Get(':routeId/last-points')
  getLastPoints(
    @Param('routeId', ParseIntPipe) routeId: number,
    @Query() q: LastPointsQueryDto,
  ) {
    const n = Math.max(1, Math.min(5000, q?.n ?? 200));
    return this.service.getLastPoints(routeId, n);
  }

  /** جزئیات یک مسیر (با/بدون نقاط) */
  @Get(':routeId')
  getOneRoute(
    @Param('routeId', ParseIntPipe) routeId: number,
    @Query() q: GetOneQueryDto,
  ) {
    const include = q.includePoints !== 'false';
    return this.service.getOne(routeId, { includePoints: include });
  }

  /** مسیر فعال فعلی راننده */
  @Get('active/by-driver/:driverId')
  getActiveRoute(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getActiveRoute(driverId);
  }

  /** گزینه‌های مانیتورینگ/نمایش راننده */
  @Get('options/:driverId')
  getDriverOptions(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getDriverOptions(driverId);
  }

  /** پردازش اساینمنت‌های قدیمی بدون Route */
  @Post('process-unprocessed-assignments')
  processUnprocessed() {
    return this.service.processUnprocessedAssignments();
  }

  /* ----------- Telemetry ingest (vehicle → driver/route) ----------- */
  /**
   * ورودی تله‌متری انعطاف‌پذیر:
   * - اگر body آرایه باشد → بچ
   * - اگر body.items آرایه باشد → بچ
   * - در غیر این صورت → تکی
   * سرویس بر اساس ts هر آیتم، راننده/Route را همان لحظه resolve می‌کند.
   */
  @Post('telemetry/:vehicleId')
  async ingestFlexible(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() body: TelemetryMsg | TelemetryMsg[] | { items?: TelemetryMsg[] },
  ) {
    if (Array.isArray(body)) {
      if (!body.length) throw new BadRequestException('empty batch');
      return this.service.ingestTelemetryBatchForVehicle(vehicleId, body);
    }
    if (Array.isArray((body as any)?.items)) {
      const items = (body as any).items as TelemetryMsg[];
      if (!items.length) throw new BadRequestException('empty batch');
      return this.service.ingestTelemetryBatchForVehicle(vehicleId, items);
    }
    return this.service.ingestTelemetryForVehicle(vehicleId, body as TelemetryMsg);
  }

  /** مسیرهای جداگانهٔ تکی/بچ (در صورت نیاز به سازگاری با کلاینت‌های قدیمی) */
  @Post('telemetry/:vehicleId/one')
  ingestOne(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() body: TelemetryMsg,
  ) {
    return this.service.ingestTelemetryForVehicle(vehicleId, body);
  }

  @Post('telemetry/:vehicleId/batch')
  ingestBatch(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body('items') items: TelemetryMsg[],
  ) {
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) throw new BadRequestException('empty batch');
    return this.service.ingestTelemetryBatchForVehicle(vehicleId, arr);
  }
}
