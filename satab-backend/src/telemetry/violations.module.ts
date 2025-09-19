// src/violations/violations.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViolationEntity } from './violation.entity';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ViolationEntity])],
  providers: [ViolationsService],
  controllers: [ViolationsController],
  exports: [ViolationsService], // ⬅️ حتماً اکسپورت شود
})
export class ViolationsModule {}
