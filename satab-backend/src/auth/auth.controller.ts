// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Users } from '../users/users.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(Users) private readonly usersRepo: Repository<Users>, // ⬅️
  ) { }

  @Post('login')
  async login(@Body() body: { phone: string; password: string }) {
    const user = await this.authService.validateUser(body.phone, body.password);
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() body: { phone: string; password: string; full_name: string }) {
    return this.authService.register(body.phone, body.password, body.full_name);
  }

  @UseGuards(JwtAuthGuard) // ✅ اضافه کن
  @Get('me')
  async getProfile(@CurrentUser() user: Users) {
    // ممکنه req.user فقط id/role داشته باشه؛ از DB اسم رو بیار
    const row = await this.usersRepo.findOne({
      where: { id: user.id },
      select: { id: true, full_name: true, role_level: true } as any,
    });
    return {
      id: row?.id ?? user.id,
      full_name: row?.full_name ?? '',   // ⬅️ اسم
      role_level: row?.role_level ?? user.role_level,
    };
  }

}



