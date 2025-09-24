// src/temporary-assignments/temporary-assignments.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemporaryAssignmentsController } from './temporary-assignments.controller';
import { TemporaryAssignmentsService } from './temporary-assignments.service';
import { TemporaryVehicleAssignment } from './temporary-vehicle-assignment.entity';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TemporaryVehicleAssignment]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        // اگر global prefix داری (مثل /api) همین‌جا لحاظش کن
        const baseURL =
          cfg.get<string>('INTERNAL_API_BASE_URL') // مثلا: http://localhost:3000  یا http://localhost:3000/api
          || cfg.get<string>('APP_BASE_URL')
          || 'http://localhost:3000';
        return {
          baseURL,
          timeout: 10_000,
          // هر هدرِ عمومی لازم:
          // headers: { Authorization: `Bearer ${cfg.get('INTERNAL_TOKEN')}` }
        };
      },
    }),
  ],
  controllers: [TemporaryAssignmentsController],
  providers: [
    TemporaryAssignmentsService,
    {
      provide: 'TemporaryVehicleAssignmentRepository',
      useFactory: (ds: DataSource) => ds.getRepository(TemporaryVehicleAssignment),
      inject: [DataSource],
    },
  ],
  exports: [TemporaryAssignmentsService],
})
export class TemporaryAssignmentsModule {}
