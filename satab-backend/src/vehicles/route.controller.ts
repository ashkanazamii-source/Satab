import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Delete,
  Put,
  Body,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard) // فقط JWT
@Controller('routes')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class RoutesController {
  constructor(private readonly service: VehiclesService) {}

  // alias: points == stations (برای سازگاری با فرانت)
  @Get(':id/points')
  getRoutePoints(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.listStationsByRouteForUser(id, Number(req.user.id));
  }

  // لیست ایستگاه‌های مسیر
  @Get(':id/stations')
  listStationsOfRoute(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.listStationsByRouteForUser(id, Number(req.user.id));
  }

  // دریافت مشخصات مسیر
  @Get(':id')
  getRoute(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.getRouteForUser(id, Number(req.user.id));
  }

  // ویرایش مسیر (نام/threshold) و در صورت ارسال، جایگزینی کامل ایستگاه‌ها
  @Put(':id')
  updateRoute(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      name?: string;
      threshold_m?: number;
      stations?: {
        order_no?: number;
        name?: string;
        lat: number;
        lng: number;
        radius_m?: number | null;
      }[];
    },
  ) {
    return this.service.updateRouteForUser(id, Number(req.user.id), body);
  }

  // فقط جایگزینی ایستگاه‌ها
  @Put(':id/stations')
  replaceStations(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    stations: {
      order_no?: number;
      name?: string;
      lat: number;
      lng: number;
      radius_m?: number | null;
    }[],
  ) {
    return this.service.replaceRouteStationsForUser(id, Number(req.user.id), stations);
  }

  // حذف مسیر
  @Delete(':id')
  async deleteRoute(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.service.deleteRouteForUser(id, Number(req.user.id));
    return { ok: true };
  }
}
