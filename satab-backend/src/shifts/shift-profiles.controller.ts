// src/shift-profiles/shift-profiles.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ShiftProfilesService } from './shift-profiles.service';
import { CreateShiftProfileDto } from '../dto/create-shift-profile.dto';
import { UpdateShiftProfileDto } from '../dto/update-shift-profile.dto';
import { ApplyShiftProfileDto } from '../dto/apply-shift-profile.dto';

@Controller('shift-profiles')
export class ShiftProfilesController {
  constructor(private readonly shiftProfilesService: ShiftProfilesService) {}

  @Get()
  list() {
    return this.shiftProfilesService.list();
  }

  @Post()
  create(@Body() dto: CreateShiftProfileDto) {
    return this.shiftProfilesService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateShiftProfileDto) {
    return this.shiftProfilesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.shiftProfilesService.remove(id);
  }

  @Post(':id/apply')
  applyProfile(@Param('id', ParseIntPipe) id: number, @Body() dto: ApplyShiftProfileDto) {
    return this.shiftProfilesService.applyProfile(id, dto);
  }
}
