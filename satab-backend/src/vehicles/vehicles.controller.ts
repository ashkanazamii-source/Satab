import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  UseGuards
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/create-vehicle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AclGuard } from '../acl/acl.guard';
import { ACL } from '../acl/acl.decorator';

@UseGuards(JwtAuthGuard, AclGuard)
@Controller('vehicles')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class VehiclesController {
  constructor(private readonly service: VehiclesService) { }
  @Get(':id/options')
  async getOptions(@Param('id', ParseIntPipe) id: number) {
    const options = await this.service.getEffectiveOptions(id);
    return { options }; // خروجی استاندارد برای فرانت
  }
  // ایجاد وسیله
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.service.create(dto);
  }
  // vehicles.controller.ts
  @Get(':id/telemetry')
  async getTelemetry(
    @Param('id', ParseIntPipe) id: number,
    @Query('keys') keys?: string | string[]
  ) {
    const ks = Array.isArray(keys) ? keys : (keys ? String(keys).split(',') : []);
    return this.service.readVehicleTelemetry(id, ks);
  }

  @Get(':id/stations')
  getStations(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.listStationsByVehicleForUser(id, +req.user.id); // ✅
  }
  @Put(':vehicleId/stations/:id')
  updateStation(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { name?: string; radius_m?: number; lat?: number; lng?: number },
  ) {
    return this.service.updateVehicleStation(vehicleId, id, dto);
  }

  @Delete(':vehicleId/stations/:id')
  async deleteStation(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.deleteVehicleStation(vehicleId, id);
    return { ok: true };
  }

@ACL({ roles: [1, 2, 3, 4, 5] })               // ⬅️ فقط همین متد نیاز دارد
@Post(':id/stations')
createStation(
  @Req() req: any,
  @Param('id', ParseIntPipe) id: number,
  @Body() body: { name: string; lat: number; lng: number; radius_m?: number },
) {
  return this.service.createStation(id, +req.user.id, body);
}

  @Delete('stations/:sid')
  removeStation(@Req() req: any, @Param('sid', ParseIntPipe) sid: number) {
    return this.service.deleteStation(sid, +req.user.id); // ✅
  }

  @Get(':id/routes/current')
  getCurrentRoute(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCurrentRouteWithMeta(id); // { route_id, name }
  }


  @Get(':id/routes')
  async listRoutes(@Param('id', ParseIntPipe) id: number) {
    return this.service.listVehicleRoutes(id);
  }

  @Post(':id/routes')
  async createRouteAndAssign(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      name: string;
      threshold_m?: number;
      points: { lat: number; lng: number; name?: string; radius_m?: number }[];
    }
  ) {
    return this.service.createRouteForVehicle(id, +req.user.id, dto);
  }

  @Put(':id/routes/current')
  async setOrUpdateCurrentRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { route_id?: number; threshold_m?: number }
  ) {
    return this.service.setOrUpdateCurrentRoute(id, body);
  }

  @Delete(':id/routes/current')
  async unassignCurrentRoute(@Param('id', ParseIntPipe) id: number) {
    return this.service.unassignCurrentRoute(id);
  }


  // بروزرسانی وسیله
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.service.update(id, dto);
  }

  // دریافت با شناسه
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // حذف
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // جستجو بر اساس کشور + پلاک (خام یا هر فرمتی)
  @Get('by-plate/search')
  findByPlate(@Query('country') country: string, @Query('plate') plate: string) {
    return this.service.findByPlate(country, plate);
  }

  // لیست وسایل در زیرمجموعه کاربر جاری (درخت کامل)
  @Get()
  list(
    @Req() req: any,
    @Query('owner_user_id') owner_user_id?: number,
    @Query('country_code') country_code?: string,
    @Query('vehicle_type_code') vehicle_type_code?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    const currentUserId = req.user?.id; // از Jwt پر می‌شود
    return this.service.list({
      currentUserId,
      owner_user_id: owner_user_id ? Number(owner_user_id) : undefined,
      country_code,
      vehicle_type_code: vehicle_type_code as any,
      page,
      limit,
    });
  }
  // پوزیشن لحظه‌ای (سیو در DB + برادکست)
  @Post(':id/pos')
  async ingestPos(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { lat: number; lng: number; ts?: string }
  ) {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') {
      throw new BadRequestException('lat/lng الزامی و عددی هستند');
    }
    await this.service.ingestVehiclePos(id, body.lat, body.lng, body.ts);
    return { ok: true };
  }

  // تله‌متری لحظه‌ای (سیو در DB + برادکست)
  @Post(':id/telemetry')
  async ingestTelemetry(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { ignition?: boolean; idle_time?: number; odometer?: number; ts?: string }
  ) {
    await this.service.ingestVehicleTelemetry(id, body);
    return { ok: true };
  }
  @Get('accessible')
  @ACL({ roles: [1, 2, 3] }) // BM هم مجاز
  async getAccessible(
    @Query('user_id', ParseIntPipe) userId: number,
    @Query('vehicle_type_code') vehicleTypeCode?: string,
    @Query('limit', new DefaultValuePipe(1000), ParseIntPipe) limit?: number,
  ) {
    return this.service.listAccessible({ userId, vehicleTypeCode, limit });
  }
}




