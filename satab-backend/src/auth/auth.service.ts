// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../users/users.entity';
import * as bcrypt from 'bcrypt';
import { UserLevel } from '../entities/role.entity';
import { LicenseService } from '../licenses/license.service';
import { ChatService } from '../chat/chat.service'; // ۱. این خط را اضافه کنید

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    private readonly jwtService: JwtService,
    private readonly licenseService: LicenseService, // اضافه کن
    private readonly chatService: ChatService, // ۲. سرویس چت را اینجا تزریق کنید


  ) { }
  async register(phone: string, password: string, full_name: string) {
    const user = this.userRepo.create({
      phone,
      password: await bcrypt.hash(password, 10),
      full_name,
      role_level: UserLevel.OWNER, // یا سطح پیش‌فرض
    });

    const savedUser = await this.userRepo.save(user);

    // ساخت لایسنس اولیه
    await this.licenseService.createInitialLicense(savedUser);
    console.log('رمز ورودی:', password);
    console.log('رمز دیتابیس:', user.password);

    return savedUser;
  }

  async validateUser(phone: string, password: string): Promise<Users> {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      console.log('📛 کاربر یافت نشد با شماره:', phone);
      throw new UnauthorizedException('کاربر یافت نشد');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('📛 رمز اشتباه برای کاربر:', phone);
      throw new UnauthorizedException('رمز عبور نادرست است');
    }

    console.log('✅ کاربر تأیید شد:', user.full_name);
    return user;
  }


  async login(user: Users) {
    const payload = { sub: user.id, phone: user.phone };

    // لاگ نقش کاربر هنگام ورود
    console.log('✅ ورود موفق کاربر با نقش:', user.role_level, '| نام:', user.full_name);

    // --- START: ADDED CODE ---
    // ۳. کاربر را به عضویت گروه عمومی درآورید
    // این کار تضمین می‌کند که همه کاربران در چت حضور داشته باشند
    await this.chatService.ensureSaGroupForUser(user.id);
    // --- END: ADDED CODE ---

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

}
