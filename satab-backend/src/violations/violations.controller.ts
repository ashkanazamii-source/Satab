// violations.controller.ts
import { Controller, Get, Param, ParseIntPipe, Query, UsePipes, ValidationPipe, DefaultValuePipe } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsISO8601, IsString } from 'class-validator';
import { ViolationsService } from './violations.service';

class ListViolationsQueryDto {
  @Type(() => Number) @IsOptional() @IsInt()
  limit?: number;

  // Offset mode
  @Type(() => Number) @IsOptional() @IsInt()
  page?: number;

  // Cursor mode
  @IsOptional() @IsISO8601()
  before?: string;

  @Type(() => Number) @IsOptional() @IsInt()
  beforeId?: number;

  @IsOptional() @IsISO8601()
  after?: string;

  @Type(() => Number) @IsOptional() @IsInt()
  afterId?: number;

  // Filters
  @IsOptional() @IsString()
  type?: string;

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;
}

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller()
export class ViolationsController {
  constructor(private readonly svc: ViolationsService) {}

  @Get('vehicles/:vehicleId/violations')
  async listForVehicle(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Query() q: ListViolationsQueryDto,
  ) {
    const limit = Math.max(1, Math.min(500, q.limit ?? 50));
    const fromD = q.from ? new Date(q.from) : undefined;
    const toD   = q.to   ? new Date(q.to)   : undefined;

    // اگر page دادیم → offset
    if (q.page) {
      return this.svc.findByVehicleOffset(vehicleId, limit, q.page, {
        type: q.type, from: fromD, to: toD,
      });
    }

    // در غیر این صورت → cursor
    return this.svc.findByVehicleCursor({
      vehicleId,
      limit,
      before: q.before,
      beforeId: q.beforeId,
      after: q.after,
      afterId: q.afterId,
      type: q.type,
      from: fromD,
      to: toD,
    });
  }
@Get('drivers/:driverId/violations')
async listForDriver(
  @Param('driverId', ParseIntPipe) driverId: number,
  @Query() q: ListViolationsQueryDto,
) {
  const limit = Math.max(1, Math.min(500, q.limit ?? 50));
  const fromD = q.from ? new Date(q.from) : undefined;
  const toD   = q.to   ? new Date(q.to)   : undefined;

  if (q.page) {
    return this.svc.findByDriverOffset(driverId, limit, q.page, {
      type: q.type, from: fromD, to: toD,
    });
  }

  return this.svc.findByDriverCursor({
    driverId,
    limit,
    before: q.before,
    beforeId: q.beforeId,
    after: q.after,
    afterId: q.afterId,
    type: q.type,
    from: fromD,
    to: toD,
  });
}

  @Get('violations/recent')
  async recent(@Query() q: ListViolationsQueryDto) {
    const limit = Math.max(1, Math.min(500, q.limit ?? 50));
    const fromD = q.from ? new Date(q.from) : undefined;
    const toD   = q.to   ? new Date(q.to)   : undefined;

    if (q.page) {
      return this.svc.latestOffset(limit, q.page, { type: q.type, from: fromD, to: toD });
    }

    return this.svc.latestCursor({
      limit,
      before: q.before,
      beforeId: q.beforeId,
      after: q.after,
      afterId: q.afterId,
      type: q.type,
      from: fromD,
      to: toD,
    });
  }
}
