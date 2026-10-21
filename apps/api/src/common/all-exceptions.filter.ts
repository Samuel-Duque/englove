import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface StandardErrorResponse {
  statusCode: number;
  code: string;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Ocurrió un error inesperado';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.code === 'string') {
          code = resObj.code;
        } else if (statusCode === HttpStatus.NOT_FOUND) {
          code = 'NOT_FOUND';
        } else if (statusCode === HttpStatus.BAD_REQUEST) {
          code = 'VALIDATION_ERROR';
        } else if (statusCode === HttpStatus.UNAUTHORIZED) {
          code = 'AUTH_UNAUTHORIZED';
        } else if (statusCode === HttpStatus.FORBIDDEN) {
          code = 'FORBIDDEN';
        } else if (statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
          code = 'PAYLOAD_TOO_LARGE';
        } else if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
          code = 'RATE_LIMITED';
        } else if (statusCode === 423) {
          code = 'AUTH_ACCOUNT_LOCKED';
        }

        if (typeof resObj.retryAfter === 'number' || typeof resObj.retryAfter === 'string') {
          response.setHeader('Retry-After', String(resObj.retryAfter));
        }

        if (typeof resObj.message === 'string') {
          message = resObj.message;
        } else if (Array.isArray(resObj.message)) {
          message = resObj.message.join(', ');
        }
      } else if (typeof res === 'string') {
        message = res;
      }
    } else {
      // Unexpected exception: log operational metadata without sensitive PII (Rule G-C10)
      this.logger.error(`Error no controlado procesando ${request.method} ${request.url}`);
    }

    const payload: StandardErrorResponse = {
      statusCode,
      code,
      message,
    };

    // Client response NEVER contains stack traces, queries or internal technical details (RF-5, Rule G-C10)
    response.status(statusCode).json(payload);
  }
}
