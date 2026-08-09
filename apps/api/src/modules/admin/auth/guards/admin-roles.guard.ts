import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@splitsaathi/db';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';
import type { AuthenticatedAdmin } from '../decorators/current-admin.decorator';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin: AuthenticatedAdmin | undefined = request.admin;

    if (!admin) {
      throw new ForbiddenException('Admin context missing.');
    }

    if (admin.role === 'super_admin') {
      return true;
    }

    if (!requiredRoles.includes(admin.role)) {
      throw new ForbiddenException(
        `Insufficient admin permissions. Required role: ${requiredRoles.join(', ')} (your role: ${admin.role})`
      );
    }

    return true;
  }
}
