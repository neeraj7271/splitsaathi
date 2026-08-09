import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ApiConfigService } from '../../config/api-config.service';
import { AdminJwtAuthGuard } from './auth/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from './auth/guards/admin-roles.guard';
import { ADMIN_ROLES_KEY } from './auth/decorators/admin-roles.decorator';

describe('Admin Module Security & Guards', () => {
  let reflector: Reflector;
  let jwtService: JwtService;
  let config: ApiConfigService;
  let adminJwtGuard: AdminJwtAuthGuard;
  let adminRolesGuard: AdminRolesGuard;

  const mockAdminSecret = 'super-admin-secret-access-key-32chars-min';
  const mockUserSecret = 'user-mobile-access-secret-32chars-min';

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({});
    config = {
      env: {
        JWT_ADMIN_ACCESS_SECRET: mockAdminSecret,
        JWT_ACCESS_SECRET: mockUserSecret
      }
    } as any;

    adminJwtGuard = new AdminJwtAuthGuard(reflector, jwtService, config);
    adminRolesGuard = new AdminRolesGuard(reflector);
  });

  const createMockContext = (authHeader?: string, adminContext?: any): ExecutionContext => {
    const request = {
      headers: {
        authorization: authHeader
      },
      admin: adminContext
    };

    return {
      getHandler: () => () => {},
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as any;
  };

  describe('AdminJwtAuthGuard', () => {
    it('should throw UnauthorizedException if bearer token is missing', async () => {
      const ctx = createMockContext(undefined);
      await expect(adminJwtGuard.canActivate(ctx)).rejects.toThrow(
        new UnauthorizedException('Missing admin bearer token.')
      );
    });

    it('should throw UnauthorizedException if token is signed with regular user secret instead of admin secret', async () => {
      // User token signed with mobile user secret
      const userToken = jwtService.sign(
        { sub: 'user-123', phoneE164: '+919999999999' },
        { secret: mockUserSecret }
      );

      const ctx = createMockContext(`Bearer ${userToken}`);
      await expect(adminJwtGuard.canActivate(ctx)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired admin bearer token.')
      );
    });

    it('should throw UnauthorizedException if token has incorrect audience', async () => {
      const wrongAudToken = jwtService.sign(
        { sub: 'admin-123', email: 'admin@example.com', role: 'super_admin', aud: 'splitsaathi-mobile-user' },
        { secret: mockAdminSecret }
      );

      const ctx = createMockContext(`Bearer ${wrongAudToken}`);
      await expect(adminJwtGuard.canActivate(ctx)).rejects.toThrow(
        new UnauthorizedException('Invalid token audience for admin module.')
      );
    });

    it('should attach admin payload to request when token is valid and signed with admin secret', async () => {
      const validAdminToken = jwtService.sign(
        { sub: 'admin-123', email: 'ops@thesplitsaathi.com', role: 'ops_admin', aud: 'splitsaathi-superadmin', sid: 'session-456' },
        { secret: mockAdminSecret }
      );

      const ctx = createMockContext(`Bearer ${validAdminToken}`);
      const result = await adminJwtGuard.canActivate(ctx);

      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest();
      expect(req.admin).toEqual({
        adminId: 'admin-123',
        email: 'ops@thesplitsaathi.com',
        role: 'ops_admin',
        sessionId: 'session-456'
      });
    });
  });

  describe('AdminRolesGuard', () => {
    it('should allow access if no roles decorator is set', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const ctx = createMockContext(undefined, { role: 'read_only' });
      expect(adminRolesGuard.canActivate(ctx)).toBe(true);
    });

    it('should allow super_admin role to access any guarded route', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['finance_admin']);
      const ctx = createMockContext(undefined, { role: 'super_admin' });
      expect(adminRolesGuard.canActivate(ctx)).toBe(true);
    });

    it('should allow access if admin has matching role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ops_admin', 'super_admin']);
      const ctx = createMockContext(undefined, { role: 'ops_admin' });
      expect(adminRolesGuard.canActivate(ctx)).toBe(true);
    });

    it('should throw ForbiddenException if admin has insufficient role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['super_admin', 'finance_admin']);
      const ctx = createMockContext(undefined, { role: 'read_only' });

      expect(() => adminRolesGuard.canActivate(ctx)).toThrow(
        new ForbiddenException(
          'Insufficient admin permissions. Required role: super_admin, finance_admin (your role: read_only)'
        )
      );
    });
  });
});
