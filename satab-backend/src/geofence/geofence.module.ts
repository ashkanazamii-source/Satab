import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeofenceEntity } from './geofence.entity';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';
import { ViolationsModule } from '../telemetry/violations.module';

@Module({
  imports: [TypeOrmModule.forFeature([GeofenceEntity]),ViolationsModule],
  providers: [GeofenceService],
  controllers: [GeofenceController],
  exports: [GeofenceService],
})
export class GeofenceModule {}
