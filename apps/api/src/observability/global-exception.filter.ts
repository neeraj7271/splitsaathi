import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const message = exception instanceof Error ? exception.message : 'Unhandled error';
    this.logger.error(
      JSON.stringify({
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        status,
        message: redact(message)
      })
    );
    response.status(status).json({
      statusCode: status,
      message,
      requestId: request.requestId
    });
  }
}

function redact(value: string): string {
  return value.replace(/\b\d{6}\b/g, '[otp]').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]');
}
