// src/auth/auth.controller.ts
import { Controller, Post, Body ,UseGuards , Get} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Users } from '../users/users.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
getProfile(@CurrentUser() user: Users) {
  return {
    id: user.id,
    role_level: user.role_level,
  };
}

}



