import { SetMetadata } from '@nestjs/common';

export const ACL_KEY = 'acl_roles';
export const ACL = (options: { roles: number[]; permissions?: string[] }) =>
  SetMetadata(ACL_KEY, options);
