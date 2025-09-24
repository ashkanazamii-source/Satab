// src/temporary-assignments/temporary-assignments.controller.ts
import { Controller, Post, Body, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { TemporaryAssignmentsService } from './temporary-assignments.service';

type CreateTempAssignDto = {
  vehicle_ids: number[];
  temp_profile: any;
  // 🔹 جدید
  start_at?: string;           // ISO string (اختیاری)
  duration_minutes?: number;   // اختیاری
  until?: string;              // ISO string اختیاری
};

@Controller('temporary-assignments')
export class TemporaryAssignmentsController {
  constructor(private readonly svc: TemporaryAssignmentsService) {}

  @Post()
  create(@Body() dto: CreateTempAssignDto) {
    return this.svc.createAndApply(dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.svc.cancelAndRestore(id);
  }
}
