// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './jwt-payload.interface';
import { Users } from '../users/users.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '', // اگر مقدار نداشت، رشته خالی
    });

    if (!configService.get<string>('JWT_SECRET')) {
      throw new Error('❌ JWT_SECRET is not defined in environment variables');
    }
  }

  async validate(payload: JwtPayload): Promise<Users> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }

    return user;
  }
}
