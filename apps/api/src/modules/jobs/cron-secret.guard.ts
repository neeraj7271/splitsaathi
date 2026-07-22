import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiConfigService } from '../../config/api-config.service';

/**
 * Protects cron job HTTP endpoints with a shared secret.
 * Callers must send header: `x-cron-secret: <CRON_SECRET>`.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ApiConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.env.CRON_SECRET;
    if (!expected) {
      throw new UnauthorizedException('CRON_SECRET is not configured on this server.');
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = request.headers['x-cron-secret'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing x-cron-secret header.');
    }
    return true;
  }
}
