import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'production' && process.env.API_REQUEST_LOGGING !== 'true') {
      next();
      return;
    }

    const startedAt = Date.now();
    const method = request.method;
    const path = request.originalUrl;
    const body =
      request.body && typeof request.body === 'object' && Object.keys(request.body).length > 0
        ? truncate(JSON.stringify(request.body))
        : '';

    this.logger.log(`→ ${method} ${path}${body ? ` | payload: ${body}` : ''}`);

    response.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const status = response.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'log';
      this.logger[level](`← ${status} ${method} ${path} (${durationMs}ms)`);
    });

    next();
  }
}

function truncate(value: string, max = 1200) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}… [truncated]`;
}
