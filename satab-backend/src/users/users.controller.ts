import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  Put,
  NotFoundException,
  Delete
} from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Users } from './users.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AclGuard } from '../acl/acl.guard';
import { ACL } from '../acl/acl.decorator';
import { UpdateUserDto } from '../dto/create-user.dto';
import { Audit } from '../audit/audit.decorator';
import { AuditTopic } from '../audit/audit-topics';

@Controller('users')
@UseGuards(JwtAuthGuard) // همه اکشن‌ها نیاز به لاگین دارند
export class UserController {
  constructor(private readonly userService: UserService) { }

  /** لیست کاربران (فقط مدیرکل) */
  @Get()
  @UseGuards(AclGuard)
  @ACL({ roles: [1] }) // فقط مدیرکل
  async getAll(@Query('roleLevel') roleLevel?: string) {
    const role = roleLevel ? parseInt(roleLevel, 10) : undefined;
    return this.userService.findAll(role);
  }

  /** ایجاد کاربر (مدیرکل یا سوپرادمین با create_user) */
  @Post()
  @UseGuards(AclGuard)
  //@Audit({ topic: AuditTopic.USER_CREATE, successOnly: false, message: 'درخواست ایجاد کاربر' })
  @ACL({ permissions: ['create_user'], roles: [1, 2] })
  async create(@Body() dto: CreateUserDto, @CurrentUser() currentUser: Users) {
    return this.userService.create(dto, currentUser);
  }

  /** ویرایش کاربر (مدیرکل یا سوپرادمین با create_user) */
  @Put(':id')
  @UseGuards(AclGuard)
  @ACL({ permissions: ['create_user'], roles: [1, 2] })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
    @CurrentUser() currentUser: Users,
  ) {
    return this.userService.updateUserById(id, body, currentUser);
  }
  /** دریافت درخت سلسله‌مراتبِ یک کاربر (مدیرکل: آزاد، SA: فقط روی زیردرخت خودش) */
  @Get('/hierarchy/:id')
  @UseGuards(AclGuard)
  @ACL({ roles: [1, 2] })
  async getUserHierarchy(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: Users,
  ) {
    return this.userService.getUserHierarchyScoped(id, currentUser);
  }
  @Get('me/ancestor')
  @UseGuards(AclGuard)
  @ACL({ roles: [1, 2, 3, 4, 5] })
  async getMyAncestorByLevel(
    @CurrentUser() currentUser: Users,
    @Query('level', ParseIntPipe) level: number,
  ) {
    const a = await this.userService.findFirstAncestorByLevel(currentUser.id, level);
    return a ? { id: a.id, full_name: a.full_name, role_level: a.role_level } : null;
  }
  @Get('my-ancestor')
  @UseGuards(AclGuard)
  @ACL({ roles: [1, 2, 3, 4, 5, 6] }) // یا حداقل [2,3]
  async getMyAncestor(
    @Query('level', ParseIntPipe) level: number,
    @CurrentUser() currentUser: Users,
  ) {
    const anc = await this.userService.findFirstAncestorByLevel(currentUser.id, level);
    if (!anc) throw new NotFoundException('جد با این سطح پیدا نشد.');
    return { id: anc.id, full_name: anc.full_name, role_level: anc.role_level };
  }
  /** مخصوص سوپرادمین والد */
  @Get('me/ancestor-super-admin')
  @UseGuards(AclGuard)
  @ACL({ roles: [1, 2, 3, 4, 5] })
  async getMySuperAdmin(@CurrentUser() currentUser: Users) {
    const sa = await this.userService.findFirstAncestorByLevel(currentUser.id, 2);
    return sa ? { id: sa.id, full_name: sa.full_name, role_level: sa.role_level } : null;
  }
  /** زیرمجموعه‌های مستقیم کاربر جاری (مدیرکل/سوپرادمین) */
  @Get('/my-subordinates')
  @UseGuards(AclGuard)
  @ACL({ roles: [1, 2] })
  async getMySubordinates(@CurrentUser() user: Users) {
    return this.userService.findDirectSubordinates(user.id);
  }

  /** همه زیرمجموعه‌ها به صورت فلت (مدیرکل/سوپرادمین) */
  @Get('/my-subordinates-flat')
  @UseGuards(AclGuard)
  @ACL({ roles: [1, 2, 3, 4, 5] })
  async getMySubordinatesFlat(@CurrentUser() user: Users) {
    return this.userService.findFlatSubordinates(user.id);
  }

  /** دریافت یک کاربر (مدیرکل: آزاد، SA: فقط روی زیردرخت خودش) */
  @Get(':id')
  @UseGuards(AclGuard)
  @ACL({ roles: [1, 2, 3, 4, 5] })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: Users,
  ) {
    return this.userService.findOneScoped(id, currentUser);
  }
  @Delete(':id')
  @UseGuards(AclGuard)
  @ACL({ permissions: ['create_user'], roles: [1, 2] })
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: Users,
  ) {
    await this.userService.deleteUserById(id, currentUser);
    return { ok: true };
  }
}

