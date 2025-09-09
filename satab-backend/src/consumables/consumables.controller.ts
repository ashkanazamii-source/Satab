// consumables.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, ParseIntPipe, Body, UsePipes, ValidationPipe
} from '@nestjs/common';
import { ConsumablesService } from './consumables.service';
import { CreateConsumableDto, UpdateConsumableDto } from '../dto/consumables.dto';

@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Controller('vehicles/:vehicleId/consumables')
export class ConsumablesController {
  constructor(private readonly service: ConsumablesService) {}

  @Get()
  list(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.service.list(vehicleId);
  }

  @Get(':id')
  getOne(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getOne(vehicleId, id);
  }

  @Post()
  create(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateConsumableDto,
  ) {
    return this.service.create(vehicleId, dto);
  }

  @Patch(':id')
  update(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConsumableDto,
  ) {
    return this.service.update(vehicleId, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.remove(vehicleId, id);
  }
}
