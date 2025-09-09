import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverRoute } from '../drivers/driver-route.entity';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';
import { VehiclesModule } from '../vehicles/vehicles.module'; // 👈 اضافه کن

@Module({
  imports: [TypeOrmModule.forFeature([DriverRoute]),
  VehiclesModule],
  controllers: [TracksController],
  providers: [TracksService],
  exports: [TracksService],
})
export class TracksModule { }
