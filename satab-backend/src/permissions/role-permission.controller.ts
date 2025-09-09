import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseGuards,
  ParseIntPipe,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { RolePermissionService } from './role-permission.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ACL } from '../acl/acl.decorator';
import { AclGuard } from '../acl/acl.guard';
import { UserService } from '../users/users.service';


@Controller('role-permissions')
@UseGuards(JwtAuthGuard, AclGuard)
export class RolePermissionController {
  constructor(
    private readonly rolePermissionService: RolePermissionService,
    private readonly userService: UserService,

  ) { }

  @Get('user/:id')
  @ACL({ roles: [1, 2, 3] })
  getPermissionsByUser(@Param('id', ParseIntPipe) userId: number) {
    return this.rolePermissionService.getByUserId(userId);
  }

  @Put('user/:id')
  @ACL({ roles: [1, 2] })
  updateUserPermissions(
    @Req() req,
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: { permissions: { action: string; is_allowed: boolean }[] },
  ) {
    return this.rolePermissionService.updatePermissionsForUser(
      userId, body?.permissions || [], req.user?.id,
    );
  }

  @Post('user/:id/permission')
  @ACL({ roles: [1] })
  setPermission(
    @Req() req,
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: { action: string; is_allowed: boolean },
  ) {
    return this.rolePermissionService.setPermission(
      userId, body.action, body.is_allowed, req.user?.id
    );
  }

  @Get('sync-existing-permissions')
  @ACL({ roles: [1] })
  sync(@Req() req) {
    return this.rolePermissionService.seedPermissionsForExistingSuperAdmins(req.user?.id);
  }

  @Get('by-levels')
  @ACL({ roles: [1] })
  getByLevels(
    @Query('granter_level', ParseIntPipe) granterLevel: number,
    @Query('target_level', ParseIntPipe) targetLevel: number,
  ) {
    return this.rolePermissionService.getByLevels(granterLevel, targetLevel);
  }

  @Delete('user/:id/permission')
  @ACL({ roles: [1] })
  deletePermission(
    @Req() req,
    @Param('id', ParseIntPipe) userId: number,
    @Query('action') action: string,
  ) {
    return this.rolePermissionService.deletePermissionByUser(userId, action, req.user?.id);
  }

  @Get()
  @ACL({ roles: [1] })
  getAll() {
    return this.rolePermissionService.getAll();
  }

  @Get('grantable')
  @ACL({ roles: [1, 2] })
  getGrantable(@Req() req, @Query('target_level') targetLevel?: string) {
    const tl = targetLevel ? Number(targetLevel) : undefined;
    return this.rolePermissionService.getGrantableActions(req.user.id, tl);
  }

  @Put(':id')
  @ACL({ roles: [1] })
  updateUserById(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { full_name?: string; phone?: string },
  ) {
    return this.userService.updateUserById(id, body);
  }

  @Put('user/:id/bounded')
  @ACL({ roles: [1, 2] })
  updateUserPermissionsBounded(
    @Req() req,
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: { permissions: { action: string; is_allowed: boolean }[] },
  ) {
    return this.rolePermissionService.updatePermissionsForUserBounded(
      req.user.id,
      userId,
      body?.permissions || [],
    );
  }
} 
