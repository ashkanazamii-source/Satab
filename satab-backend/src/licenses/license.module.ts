// src/licenses/license.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from './license.entity';
import { LicenseService } from './license.service';

@Module({
  imports: [TypeOrmModule.forFeature([License])],
  providers: [LicenseService],
  exports: [LicenseService], // برای استفاده در AuthService و سایر سرویس‌ها
})
export class LicenseModule {}
