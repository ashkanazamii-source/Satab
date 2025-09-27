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

// 🔹 برای ورودی تله‌متری
type TelemetryMsg = {
  ts: string | Date;
  ignition?: boolean;
  idle_time?: number;           // sec
  odometer?: number;            // km
  engine_on_duration?: number;  // sec
  distance_m?: number;          // متر
  mission_count?: number;       // تعداد مأموریت تا این پیام
  [k: string]: any;
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

  // =======================
  // 🔹 ورودی تله‌متری (تکی)
  // POST /temporary-assignments/telemetry/:vehicleId
  // body: TelemetryMsg
  // =======================
  @Post('telemetry/:vehicleId')
  async ingestOne(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() body: TelemetryMsg,
  ) {
    return this.svc.ingestTelemetryForVehicle(vehicleId, body);
  }

  // =======================
  // 🔹 ورودی تله‌متری (بچ)
  // POST /temporary-assignments/telemetry/:vehicleId/batch
  // body: { items: TelemetryMsg[] }
  // =======================
  @Post('telemetry/:vehicleId/batch')
  async ingestBatch(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body('items') items: TelemetryMsg[],
  ) {
    return this.svc.ingestTelemetryBatchForVehicle(vehicleId, Array.isArray(items) ? items : []);
  }
}
