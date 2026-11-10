import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const message =
      typeof errorResponse === 'object' && errorResponse !== null && 'message' in errorResponse
        ? (errorResponse as Record<string, unknown>).message
        : errorResponse;

    const correlationId = (request as any).correlationId;

    this.logger.error(
      `[${request.method}] ${request.url} [Correlation: ${correlationId || 'N/A'}] - Status ${status} - Error: ${JSON.stringify(message)}`
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: correlationId || undefined,
      message,
    });
  }
}
