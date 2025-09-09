import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AclGuard } from '../acl/acl.guard';
import { ACL } from '../acl/acl.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Users } from '../users/users.entity';
import { LogQueryDto } from '../dto/log-query.dto';

@Controller('logs')
@UseGuards(JwtAuthGuard, AclGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  // نقش‌های ۱ تا ۵ اجازه دارند
  @Get()
  @ACL({ roles: [1, 2, 3, 4, 5] /*, permissions: ['view_logs']*/ })
  async getLogs(@CurrentUser() me: Users, @Query() query: LogQueryDto) {
    return this.audit.findAll(me, query);
  }
}
