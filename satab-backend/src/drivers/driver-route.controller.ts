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
} from '@nestjs/common';
import { IsNumber, IsOptional, IsEnum, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { DriverRouteService } from './driver-route.service';
import { DriverRouteStatus } from './driver-route.entity';

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
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsISO8601()
  ts?: string;
}

class ListQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(DriverRouteStatus)
  status?: DriverRouteStatus;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  limit?: number;
}

class StatsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

class GetOneQueryDto {
  @IsOptional()
  includePoints?: 'true' | 'false';
}

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('driver-routes')
export class DriverRouteController {
  constructor(private readonly service: DriverRouteService) { }

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
  @Post('process-unprocessed-assignments')
  processUnprocessed() {
    return this.service.processUnprocessedAssignments();
  }
  
  @Get('options/:driverId')
  getDriverOptions(
    @Param('driverId', ParseIntPipe) driverId: number,
  ) {
    return this.service.getDriverOptions(driverId);
  }

  @Get(':routeId')
  getOneRoute(
    @Param('routeId', ParseIntPipe) routeId: number,
    @Query() q: GetOneQueryDto,
  ) {
    const include = q.includePoints !== 'false';
    return this.service.getOne(routeId, { includePoints: include });
  }
  @Get('options/:driverId')
  getOptions(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getDriverOptions(driverId);
  }
  @Get('active/by-driver/:driverId')
  getActiveRoute(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getActiveRoute(driverId);
  }

}
