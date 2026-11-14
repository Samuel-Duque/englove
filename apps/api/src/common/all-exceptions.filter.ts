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
  details?: unknown;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const KNOWN_BODY_PARSER_TYPES = new Set([
  'entity.too.large',
  'entity.parse.failed',
  'encoding.unsupported',
  'charset.unsupported',
  'parameters.too.many',
  'request.aborted',
  'request.size.invalid',
  'stream.encoding.set',
  'stream.not.readable',
]);

function mapParserError(exception: unknown): {
  statusCode: number;
  code: string;
  message: string;
} | null {
  if (!isRecord(exception)) {
    return null;
  }

  const rawType = typeof exception.type === 'string' ? exception.type : undefined;
  const isParserError =
    (rawType !== undefined && KNOWN_BODY_PARSER_TYPES.has(rawType)) ||
    (exception.expose === true && rawType !== undefined);
  if (!isParserError) {
    return null;
  }

  const rawStatus =
    typeof exception.status === 'number'
      ? exception.status
      : typeof exception.statusCode === 'number'
        ? exception.statusCode
        : undefined;

  if (rawType === 'entity.too.large' || rawStatus === HttpStatus.PAYLOAD_TOO_LARGE) {
    return {
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'La solicitud supera el tamaño máximo permitido',
    };
  }

  if (rawType === 'entity.parse.failed' || rawStatus === HttpStatus.BAD_REQUEST) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: 'El cuerpo de la solicitud no es válido',
    };
  }

  if (
    rawType === 'encoding.unsupported' ||
    rawType === 'charset.unsupported' ||
    rawStatus === HttpStatus.UNSUPPORTED_MEDIA_TYPE
  ) {
    return {
      statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Formato o codificación de solicitud no compatible',
    };
  }

  if (rawStatus !== undefined && rawStatus >= 400 && rawStatus < 500) {
    return {
      statusCode: rawStatus,
      code: rawStatus === HttpStatus.TOO_MANY_REQUESTS ? 'RATE_LIMITED' : 'VALIDATION_ERROR',
      message: 'La solicitud no pudo procesarse',
    };
  }

  return null;
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
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (isRecord(res)) {
        if (typeof res.code === 'string') {
          code = res.code;
        } else if (statusCode === HttpStatus.NOT_FOUND) {
          code = 'NOT_FOUND';
        } else if (statusCode === HttpStatus.BAD_REQUEST) {
          code = 'VALIDATION_ERROR';
        } else if (statusCode === HttpStatus.UNAUTHORIZED) {
          code = 'AUTH_UNAUTHORIZED';
        } else if (statusCode === HttpStatus.FORBIDDEN) {
          code = 'AUTH_FORBIDDEN';
        } else if (statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
          code = 'PAYLOAD_TOO_LARGE';
        } else if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
          code = 'RATE_LIMITED';
        } else if (statusCode === 423) {
          code = 'AUTH_ACCOUNT_LOCKED';
        }

        if (typeof res.retryAfter === 'number' || typeof res.retryAfter === 'string') {
          response.setHeader('Retry-After', String(res.retryAfter));
        }

        if (typeof res.message === 'string') {
          message = res.message;
        } else if (Array.isArray(res.message)) {
          message = res.message.join(', ');
        }

        if (res.details !== undefined) {
          details = res.details;
        }
      } else if (typeof res === 'string') {
        message = res;
      }
    } else {
      const parserError = mapParserError(exception);
      if (parserError) {
        statusCode = parserError.statusCode;
        code = parserError.code;
        message = parserError.message;
      } else {
        // Unexpected exception: log operational metadata without sensitive PII (Rule G-C10, P1-01)
        const rawUrl = request.originalUrl || request.url || '';
        const sanitizedUrl = rawUrl ? rawUrl.split('?')[0] : '';
        this.logger.error(`Error no controlado procesando ${request.method} ${sanitizedUrl}`);
      }
    }

    const appMinVersion = process.env.APP_MIN_VERSION;
    if (appMinVersion && !response.getHeader('X-App-Min-Version')) {
      response.setHeader('X-App-Min-Version', appMinVersion.trim());
    }

    const payload: StandardErrorResponse = {
      statusCode,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    };

    // Client response NEVER contains stack traces, queries or internal technical details (RF-5, Rule G-C10)
    response.status(statusCode).json(payload);
  }
}
