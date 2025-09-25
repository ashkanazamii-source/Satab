
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverRoute } from './driver-route.entity';
import { Users } from '../users/users.entity';
import { DriverRouteService } from './driver-route.service';
import { DriverRouteGateway } from './driver-route.gateway';
import { DriverRouteController,  } from './driver-route.controller';
import { DriverRouteIngestController } from './driver-routes.ingest.controller';

@Module({
  imports: [
    // معرفی Entity های مورد نیاز این ماژول
    TypeOrmModule.forFeature([DriverRoute, Users]),
  ],
  controllers: [
    // معرفی تمام کنترلرهای این ماژول
    DriverRouteController,
    DriverRouteIngestController,
  ],
  providers: [
    // معرفی تمام سرویس‌ها و گیت‌وی‌های این ماژول
    DriverRouteService,
    DriverRouteGateway,
  ],
  exports: [
    // اکسپورت کردن سرویس اصلی تا ماژول‌های دیگر بتوانند از آن استفاده کنند
    DriverRouteService,
  ],
})
export class DriverRouteModule {}