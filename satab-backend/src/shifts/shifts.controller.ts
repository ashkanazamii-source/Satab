// src/shifts/shifts.controller.ts
import {
  Controller, Get, Query, Post, Body, Put, Param, Delete, ParseIntPipe, UsePipes, ValidationPipe
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { QueryShiftsDto } from '../dto/query-shifts.dto';
import { CreateShiftDto } from '../dto/create-shift.dto';
import { UpdateShiftDto } from '../dto/update-shift.dto';

@Controller('shifts')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get()
  async list(@Query() q: QueryShiftsDto) {
    const { driverId, from, to } = q;
    return this.service.listByDriverAndRange(driverId, from, to);
  }

  @Post()
  async create(@Body() dto: CreateShiftDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateShiftDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { ok: true };
  }

  @Post(':id/publish')
  async publish(@Param('id', ParseIntPipe) id: number) {
    return this.service.publish(id);
  }

  @Post(':id/lock')
  async lock(@Param('id', ParseIntPipe) id: number) {
    return this.service.lock(id);
  }
}
