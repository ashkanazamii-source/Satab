// src/telemetry/telemetry.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('ingest')
export class TelemetryController {
  constructor(private readonly svc: TelemetryService) {}

  @Post('position')
  async position(@Body() body: {
    device_id: string;     // شناسه برد
    lat: number;
    lng: number;
    ts?: number;           // اختیاری: time from device
  }) {
    await this.svc.ingestPosition(body);
    return { ok: true };
  }
}
