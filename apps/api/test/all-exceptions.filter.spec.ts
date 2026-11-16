import { describe, it, expect, vi } from 'vitest';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { ConflictException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import express, { type NextFunction, type Request, type Response } from 'express';

describe('AllExceptionsFilter (QA-07, P0-09, P1-01)', () => {
  const createMockHost = (url = '/api/v1/test?search=sensitive@email.com') => {
    const mockResponse: Partial<Response> = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      getHeader: vi.fn().mockReturnValue(undefined),
    };

    const mockRequest: Partial<Request> = {
      method: 'POST',
      url,
      originalUrl: url,
    };

    const mockHost: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: <T = Response>() => mockResponse as unknown as T,
        getRequest: <T = Request>() => mockRequest as unknown as T,
        getNext: vi.fn(),
      }),
      getArgs: vi.fn(),
      getArgByIndex: vi.fn(),
      switchToRpc: vi.fn(),
      switchToWs: vi.fn(),
      getType: vi.fn(),
    };

    return { mockHost, mockResponse, mockRequest };
  };

  it('QA-07 / P0-09: preserva details en la respuesta ante un 409 UNCONSUMED_RETRY_WARNING', () => {
    const filter = new AllExceptionsFilter();
    const { mockHost, mockResponse } = createMockHost();

    const affectedActivities = [
      {
        assignmentId: 'asg-1',
        activityTitle: 'Vocabulary A1',
        attemptNumber: 1,
      },
    ];

    const exception = new ConflictException({
      statusCode: 409,
      code: 'UNCONSUMED_RETRY_WARNING',
      message: 'Reintentos pendientes en este grupo',
      details: { affectedActivities },
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'UNCONSUMED_RETRY_WARNING',
      message: 'Reintentos pendientes en este grupo',
      details: { affectedActivities },
    });
  });

  it('preserva el header Retry-After si el error lo incluye', () => {
    const filter = new AllExceptionsFilter();
    const { mockHost, mockResponse } = createMockHost();

    const exception = new ConflictException({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Demasiadas solicitudes',
      retryAfter: 60,
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('maneja errores no controlados sin exponer stack traces ni detalles técnicos (G-C10)', () => {
    const filter = new AllExceptionsFilter();
    const { mockHost, mockResponse } = createMockHost();

    const unexpectedError = new Error('Database connection failed: password=secret');

    filter.catch(unexpectedError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado',
    });
  });

  it('RT-12: mapea errores entity.too.large (>1 MiB) y JSON malformado de body-parser a 413/400 sin 500', async () => {
    const filter = new AllExceptionsFilter();
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
      const host: ArgumentsHost = {
        switchToHttp: () => ({
          getResponse: <T = Response>() => res as unknown as T,
          getRequest: <T = Request>() => req as unknown as T,
          getNext: vi.fn(),
        }),
        getArgs: vi.fn(),
        getArgByIndex: vi.fn(),
        switchToRpc: vi.fn(),
        switchToWs: vi.fn(),
        getType: vi.fn(),
      };
      filter.catch(err, host);
    });

    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('No se pudo iniciar servidor HTTP de prueba');
      }
      const url = `http://127.0.0.1:${address.port}/`;

      const oversized = JSON.stringify({ data: 'x'.repeat(1_200_000) });
      const resTooLarge = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: oversized,
      });
      expect(resTooLarge.status).toBe(413);
      expect(await resTooLarge.json()).toEqual({
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'La solicitud supera el tamaño máximo permitido',
      });

      const resInvalidJson = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"broken":',
      });
      expect(resInvalidJson.status).toBe(400);
      expect(await resInvalidJson.json()).toEqual({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El cuerpo de la solicitud no es válido',
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('RT-12: no reclasifica errores internos ajenos al parser aunque tengan propiedad status 4xx', () => {
    const filter = new AllExceptionsFilter();
    const { mockHost, mockResponse } = createMockHost();
    const upstreamSdkError = Object.assign(new Error('Upstream SDK 403'), {
      status: 403,
    });

    filter.catch(upstreamSdkError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado',
    });
  });
});
