import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ApiConfigService } from '../../../../config/api-config.service';
import { IS_PUBLIC_KEY } from '../../../../common/decorators/public.decorator';
import type { AdminRole } from '@splitsaathi/db';

export interface AdminAccessTokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
  aud: string;
  sid?: string;
}

@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ApiConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing admin bearer token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AdminAccessTokenPayload>(token, {
        secret: this.config.env.JWT_ADMIN_ACCESS_SECRET
      });

      if (payload.aud !== 'splitsaathi-superadmin') {
        throw new UnauthorizedException('Invalid token audience for admin module.');
      }

      request.admin = {
        adminId: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid
      };
      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired admin bearer token.');
    }
  }

  private extractBearerToken(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const [scheme, token] = value.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
