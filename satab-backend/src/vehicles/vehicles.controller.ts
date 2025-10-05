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
  UseGuards,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
// ⬇️ مسیر درست برای DTO آپدیت (داخل همین ماژول)
import { UpdateVehicleDto } from '../dto/create-vehicle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AclGuard } from '../acl/acl.guard';
import { ACL } from '../acl/acl.decorator';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateRouteDto } from '../dto/create-route.dto';
import { GetTrackQueryDto } from '../dto/get-track-query.dto'; // مسیر را متناسب با پروژه خود تنظیم کنید

@UseGuards(JwtAuthGuard, AclGuard)
@Controller('vehicles')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class VehiclesController {
  constructor(private readonly service: VehiclesService) { }

  // ⚠️ روت‌های استاتیک را قبل از پارامتریک بگذار تا تداخل پیش نیاید

  // جستجو بر اساس کشور + پلاک (خام یا هر فرمتی)
  @Get('by-plate/search')
  findByPlate(@Query('country') country: string, @Query('plate') plate: string) {
    return this.service.findByPlate(country, plate);
  }
  @ACL({ roles: [1, 2, 3, 4, 5] }) // سطح دسترسی مناسب را تعیین کنید
  @Get(':id/track')
  async getVehicleTrack(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetTrackQueryDto,
  ) {
    // اگر تاریخ پایان داده نشود، زمان حال در نظر گرفته می‌شود
    const toDate = query.to ? new Date(query.to) : new Date();

    // اگر تاریخ شروع داده نشود، ۲۴ ساعت قبل از تاریخ پایان در نظر گرفته می‌شود
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(toDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    if (fromDate > toDate) {
      throw new BadRequestException('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.');
    }

    // فراخوانی متد موجود در سرویس
    const dailyTracks = await this.service.getVehicleTrack(id, fromDate, toDate);

    // تجمیع تمام نقاط از روزهای مختلف در یک آرایه واحد برای راحتی فرانت‌اند
    const allPoints = dailyTracks.flatMap(day => day.track_points || []);

    // ارسال پاسخ در یک فرمت استاندارد
    return {
      vehicle_id: id,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      points_count: allPoints.length,
      points: allPoints,
    };
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
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Get(':id/routes/current/geofence')
  getRouteGeofenceState(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCurrentRouteGeofenceState(id);
  }
  // ✅ واگذاری/به‌روزرسانی مسئولِ ماشین‌ها برای یک کاربر هدف (bulk)
  @ACL({ roles: [1, 2] }) // 1=مدیرکل (global), 2=سوپرادمین
  @Put('responsible/bulk/:userId')
  async bulkAssignResponsible(
    @Req() req: any,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { vehicle_ids: number[] },
  ) {
    if (!Array.isArray(body?.vehicle_ids)) {
      throw new BadRequestException('vehicle_ids باید آرایه‌ای از اعداد باشد.');
    }
    return this.service.bulkAssignResponsible(userId, body.vehicle_ids, +req.user.id);
  }
  // vehicles.controller.ts (بالای روت‌های پارامتریک)
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Get('responsible/my')
  async listMine(@Req() req: any, @Query('limit', new DefaultValuePipe(1000), ParseIntPipe) limit: number) {
    return this.service.listMineByRole(+req.user.id, limit);
  }
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Get(':id/stations/terminals')
  async getStationTerminals(@Param('id', ParseIntPipe) id: number) {
    const res = await this.service.getStationTerminals(id);
    return {
      count: res.count,
      first_id: res.first?.id ?? null,
      last_id: res.last?.id ?? null,
      first: res.first,  // شامل name/lat/lng/radius_m
      last: res.last,
    };
  }

  /** بررسی اینکه یک نقطهٔ فعلی داخل «first» است یا «last» (یا هیچ‌کدام) */
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Post(':id/stations/terminals/which')
  async whichTerminal(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { lat: number; lng: number }
  ) {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') {
      throw new BadRequestException('lat/lng الزامی و عددی هستند');
    }
    const where = await this.service.whichTerminalAtPoint(id, { lat: +body.lat, lng: +body.lng });
    return { where }; // 'first' | 'last' | null
  }

  // ژئوفنس مسیر جاری: رویدادها
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Get(':id/routes/current/geofence/events')
  getRouteGeofenceEvents(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.service.getCurrentRouteGeofenceEvents(id, limit);
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

  // ایجاد وسیله (با DTO جدید که name را می‌گیرد و tracker_imei اختیاری است)
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.service.create(dto);
  }

  // ====== روت‌های پارامتریک ======

  @Get(':id/options')
  async getOptions(@Param('id', ParseIntPipe) id: number) {
    const options = await this.service.getEffectiveOptions(id);
    return { options }; // خروجی استاندارد برای فرانت
  }

  @Get(':id/telemetry')
  async getTelemetry(
    @Param('id', ParseIntPipe) id: number,
    @Query('keys') keys?: string | string[],
    @Query('from') from?: string,   // ISO
    @Query('to') to?: string        // ISO
  ) {
    const ks = Array.isArray(keys) ? keys : keys ? String(keys).split(',') : [];
    const range = {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
    return this.service.readVehicleTelemetry(id, ks, range);
  }


  // ایستگاه‌ها
  @Get(':id/stations')
  getStations(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.listStationsByVehicleForUser(id, +req.user.id);
  }

  @Put(':vehicleId/stations/:id')
  updateStation(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { name?: string; radius_m?: number; lat?: number; lng?: number },
  ) {
    return this.service.updateVehicleStation(vehicleId, id, dto);
  }
  // vehicles.controller.ts
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Get(':id/ai/monitor')
  getAiMonitor(@Param('id', ParseIntPipe) id: number) {
    return this.service.getAiMonitor(id);
  }

  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Put(':id/ai/monitor')
  setAiMonitor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { enabled?: boolean; params?: string[] },
  ) {
    return this.service.setAiMonitor(id, body);
  }

  @Delete(':vehicleId/stations/:id')
  async deleteStation(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.deleteVehicleStation(vehicleId, id);
    return { ok: true };
  }

  // ⬇️ فقط همین متد ACL می‌خواهد (1..5)
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Post(':id/stations')
  createStation(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name: string; lat: number; lng: number; radius_m?: number },
  ) {
    return this.service.createStation(id, +req.user.id, body);
  }

  // حذف ایستگاه با sid (مالک‌محور)
  @Delete('stations/:sid')
  removeStation(@Req() req: any, @Param('sid', ParseIntPipe) sid: number) {
    return this.service.deleteStation(sid, +req.user.id);
  }

  // VehiclesController
  @Get(':id/routes/current')
  async getCurrentRoute(@Param('id', ParseIntPipe) id: number) {
    const cur = await this.service.getCurrentRouteWithMeta(id);
    return cur ?? { route_id: null, name: null, threshold_m: null };
  }


  @Get(':id/routes')
  async listRoutes(@Param('id', ParseIntPipe) id: number) {
    return this.service.listVehicleRoutes(id);
  }

  @ACL({ roles: [1, 2, 3, 4, 5, 6] })
  @Post(':id/routes')
  async createRouteAndAssign(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRouteDto,
  ) {
    try {
      return await this.service.createRouteForVehicle(id, +req.user.id, dto);
    } catch (e: any) {
      Logger.error('createRouteAndAssign failed', e?.stack || e);
      throw new InternalServerErrorException(e?.message || 'Create route failed');
    }
  }
  // VehiclesController
  @ACL({ roles: [1, 2, 3, 4, 5] })
  @Get(':id/routes/current/stations')
  async getCurrentRouteStations(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const cur = await this.service.getCurrentRouteWithMeta(id);
    if (!cur?.route_id) return [];
    return this.service.listStationsByRouteForUser(cur.route_id, +req.user.id);
  }


  @Put(':id/routes/current')
  async setOrUpdateCurrentRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { route_id?: number; threshold_m?: number },
  ) {
    return this.service.setOrUpdateCurrentRoute(id, body);
  }

  @Delete(':id/routes/current')
  async unassignCurrentRoute(@Param('id', ParseIntPipe) id: number) {
    return this.service.unassignCurrentRoute(id);
  }

  // بروزرسانی/نمایش/حذف وسیله
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.service.update(id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // پوزیشن لحظه‌ای (سیو در DB + برادکست)
  @Post(':id/pos')
  async ingestPos(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { lat: number; lng: number; ts?: string },
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
    @Body() body: { ignition?: boolean; idle_time?: number; odometer?: number; engine_temp?: number; ts?: string },
  ) {
    await this.service.ingestVehicleTelemetry(id, body);
    return { ok: true };
  }

}
