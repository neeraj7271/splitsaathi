import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      tap({
        next: () => this.record(request, response, started),
        error: () => this.record(request, response, started, true)
      })
    );
  }

  private record(request: any, response: any, started: number, error = false): void {
    this.metrics.increment('splitsaathi_http_requests_total', {
      method: request.method,
      route: request.route?.path ?? request.path,
      status: error ? response.statusCode || 500 : response.statusCode
    });
    this.metrics.increment('splitsaathi_http_request_duration_ms_total', {
      method: request.method,
      route: request.route?.path ?? request.path
    }, Date.now() - started);
  }
}
