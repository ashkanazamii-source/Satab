// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { LicenseModule } from './licenses/license.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UserModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DriverRouteModule } from './drivers/driver-route.module';
import { RolePermissionModule } from './permissions/role-permission.module';
import { VehiclePoliciesModule } from './vehicle-policies/vehicle-policies.module';
import { AllowedCountriesModule } from './country-policies/allowed-countries.module';
import { TracksModule } from './tracks/tracks.module';
import { ConsumablesModule } from './consumables/consumables.module';
import { DriverVehicleAssignmentModule } from './driver-vehicle-assignment/driver-vehicle-assignment.module';
import { GeofenceModule } from './geofence/geofence.module';
import { AuditModule } from './audit/audit.module';
import { HttpAuditInterceptor } from './audit/http-audit.interceptor';
import { GlobalExceptionFilter } from './audit/global-exception.filter';
import { ChatModule } from './chat/chat.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AnalyticsModule } from './analytics/analytics.module';
import { ProfilesModule } from './profiles/profiles.module'; // ✅ ۱. این خط را برای import اضافه کنید
import { PairingModule } from './pairing/pairing.module';
import { OtpModule } from './sms/otp.module';
import { ViolationsModule } from './telemetry/violations.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { ContextMiddleware } from './common/context.middleware';

@Module({
  imports: [
    EventEmitterModule.forRoot(),   // ⬅️ اینجا باید باشه

    // ENV
    ConfigModule.forRoot({ isGlobal: true }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,   // entityها خودکار
        synchronize: true,        // فقط توسعه؛ پروداکشن false
      }),
    }),

    RolePermissionModule,
    TracksModule,
    AllowedCountriesModule,
    VehiclePoliciesModule,
    UserModule,
    AuthModule,
    LicenseModule,
    DashboardModule,
    VehiclesModule,
    DriverRouteModule,
    ConsumablesModule,
    DriverVehicleAssignmentModule,
    GeofenceModule,
    ChatModule,
    AuditModule,
    AnalyticsModule,
    ProfilesModule,
    PairingModule,
    OtpModule,
    TelemetryModule,
    ViolationsModule,
  ],
  providers: [
    // لاگ همهٔ درخواست‌های HTTP
    { provide: APP_INTERCEPTOR, useClass: HttpAuditInterceptor },
    // ثبت همهٔ خطاها
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ست‌کردن userId / ip / userAgent برای هر درخواست (برای لاگ‌های خودکار)
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
