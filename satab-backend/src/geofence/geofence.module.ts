import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeofenceEntity } from './geofence.entity';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GeofenceEntity])],
  providers: [GeofenceService],
  controllers: [GeofenceController],
  exports: [GeofenceService],
})
export class GeofenceModule {}
