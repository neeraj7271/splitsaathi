import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminAuditLogService } from '../admin-audit-log.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutating actions (POST, PATCH, PUT, DELETE)
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const admin = request.admin;
    if (!admin || !admin.adminId) {
      return next.handle();
    }

    const path = request.route ? request.route.path : request.url;
    const action = `${method} ${path}`;
    const targetType = this.extractTargetType(path);
    const targetId = request.params?.id || request.params?.userId || request.params?.groupId || 'bulk';
    const body = request.body ? { ...request.body } : null;

    // Redact sensitive password fields from body
    if (body && typeof body === 'object') {
      if (body.password) body.password = '[REDACTED]';
      if (body.currentPassword) body.currentPassword = '[REDACTED]';
    }

    const ip = request.ip || request.headers['x-forwarded-for'] || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap((responseBody) => {
        // Asynchronously write audit log entry
        this.auditLogService
          .logAction({
            adminId: admin.adminId,
            action,
            targetType,
            targetId: String(targetId),
            before: null,
            after: { body, response: responseBody },
            ipAddress: ip || null,
            userAgent: userAgent || null
          })
          .catch((err: any) => {
            // Log silently to avoid breaking request stream
            console.error('Failed to log admin audit entry:', err);
          });
      })
    );
  }

  private extractTargetType(path: string): string {
    if (path.includes('/users')) return 'user';
    if (path.includes('/groups')) return 'group';
    if (path.includes('/expenses')) return 'expense';
    if (path.includes('/settlements')) return 'settlement';
    if (path.includes('/subscriptions')) return 'subscription';
    if (path.includes('/support')) return 'support_ticket';
    if (path.includes('/feature-flags')) return 'feature_flag';
    if (path.includes('/notifications')) return 'notification';
    if (path.includes('/management')) return 'admin_management';
    return 'system';
  }
}
