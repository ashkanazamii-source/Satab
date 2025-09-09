import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { Users } from '../users/users.entity';
import { RolePermissionModule } from '../permissions/role-permission.module';

@Global()
@Module({
    imports: [TypeOrmModule.forFeature([AuditLog, Users]), RolePermissionModule,],
    providers: [
        AuditService,
        Reflector,
        // اگر می‌خواهی اینترسپتور سراسری باشد، فعالش کن؛
        // اگر نمی‌خواهی، این provider را حذف کن و فقط هرجا نیاز بود @UseInterceptors(AuditInterceptor) بزن.
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    ],
    controllers: [AuditController],
    exports: [AuditService], // ← تا در کل پروژه inject شود
})
export class AuditModule { }
