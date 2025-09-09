// src/auth/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Users } from '../users/users.entity';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Users => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // باید قبلاً در JwtStrategy ست شده باشه
  },
);
