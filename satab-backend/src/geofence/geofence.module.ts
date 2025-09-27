// src/geofence/geofence.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeofenceEntity } from './geofence.entity';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';
import { ViolationsModule } from '../violations/violations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GeofenceEntity]),
    ViolationsModule,                    // ← برای دسترسی به ViolationsService
  ],
  controllers: [GeofenceController],
  providers: [GeofenceService],
  exports: [GeofenceService],           // ← لازم چون IngestService ازش استفاده می‌کند
})
export class GeofenceModule {}
