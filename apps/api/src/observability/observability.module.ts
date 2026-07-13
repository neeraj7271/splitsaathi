import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './global-exception.filter';
import { HealthController } from './health.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestLoggingMiddleware } from './request-logging.middleware';

@Module({
  controllers: [HealthController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter
    }
  ],
  exports: [MetricsService]
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
