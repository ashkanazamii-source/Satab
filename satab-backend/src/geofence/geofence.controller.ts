// geofence.controller.ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { CreateGeofenceDto, UpdateGeofenceDto } from '../dto/create-geofence.dto';

@Controller('vehicles/:vehicleId/geofence')
export class GeofenceController {
  constructor(private readonly svc: GeofenceService) {}

  @Get()
  get(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.svc.getForVehicle(vehicleId);
  }

  // ✅ PUT: upsert
  @Put()
  upsert(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateGeofenceDto | UpdateGeofenceDto,
  ) {
    return this.svc.upsertForVehicle(vehicleId, dto);
  }

  // ✅ POST: alias برای بعضی کلاینت‌ها (فرانت تو لاگ‌ها POST هم می‌زد)
  @Post()
  create(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateGeofenceDto,
  ) {
    return this.svc.upsertForVehicle(vehicleId, dto);
  }

  @Delete()
  async remove(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    const n = await this.svc.deleteForVehicle(vehicleId);
    return { ok: true, deleted: n };
  }

  @Post('check')
  async check(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() body: { lat: number; lng: number; driverUserId?: number | null },
  ) {
    return this.svc.checkAndRecord(vehicleId, { lat: body.lat, lng: body.lng }, body.driverUserId);
  }
}
