import { Controller, Get, Query,ValidationPipe,UsePipes } from '@nestjs/common';
import { TracksService } from './tracks.service';

// tracks.controller.ts
import { BadRequestException } from '@nestjs/common';
import { IsISO8601, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { VehiclesService } from '../vehicles/vehicles.service';

class TrackQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber()
  driver_id?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  vehicle_id?: number;

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;
}

@Controller('tracks')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class TracksController {
  constructor(private readonly svc: TracksService,private readonly service: VehiclesService) {}
  


    @Get()
  async list(
    @Query('vehicle_id') vehicle_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    if (!vehicle_id) throw new BadRequestException('vehicle_id الزامی است');
    const vId = Number(vehicle_id);
    if (!from || !to) throw new BadRequestException('from/to الزامی است');

    const fromD = new Date(from);
    const toD = new Date(to);
    if (isNaN(fromD.getTime()) || isNaN(toD.getTime())) {
      throw new BadRequestException('from/to نامعتبر است');
    }
    return this.service.getVehicleTrack(vId, fromD, toD);
  }
}
