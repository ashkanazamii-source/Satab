// src/geofence/geofence.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { CreateGeofenceDto, UpdateGeofenceDto } from '../dto/create-geofence.dto';
import { IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// DTO سخت‌گیرانه برای /check
class CheckGeofenceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  driverUserId?: number | null;
}

@Controller('vehicles/:vehicleId/geofence')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class GeofenceController {
  constructor(private readonly svc: GeofenceService) {}

  /** گرفتن پیکربندی ژئوفنس یک وسیله */
  @Get()
  async get(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    const geo = await this.svc.getForVehicle(vehicleId);
    if (!geo) throw new NotFoundException('ژئوفنس برای این وسیله تنظیم نشده است.');
    return geo;
  }

  /** upsert ژئوفنس (polygon | circle) */
  @Put()
  @HttpCode(200)
  upsert(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateGeofenceDto | UpdateGeofenceDto,
  ) {
    return this.svc.upsertForVehicle(vehicleId, dto);
  }

  /** alias برای کلاینت‌هایی که POST می‌زنند */
  @Post()
  @HttpCode(200)
  create(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateGeofenceDto,
  ) {
    return this.svc.upsertForVehicle(vehicleId, dto);
  }

  /** حذف ژئوفنس وسیله */
  @Delete()
  async remove(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    const n = await this.svc.deleteForVehicle(vehicleId);
    return { ok: true, deleted: n };
  }

  /** چک فوری نقطه و ثبت تخلف در صورت خروج (اتمیک طبق سرویس) */
  @Post('check')
  async check(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() body: CheckGeofenceDto,
  ) {
    return this.svc.checkAndRecord(
      vehicleId,
      { lat: body.lat, lng: body.lng },
      body.driverUserId ?? null,
    );
  }
}
