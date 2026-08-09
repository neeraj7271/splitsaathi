import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminRole } from '@splitsaathi/db';

export interface AuthenticatedAdmin {
  adminId: string;
  email: string;
  role: AdminRole;
  sessionId?: string;
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin;
  }
);
