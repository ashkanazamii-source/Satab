import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Users } from '../users/users.entity';
//import { Log } from '../log/log.entity'; // اگر تعریف کردی
// می‌تونی بقیه موارد رو بعداً اضافه کنی

@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
