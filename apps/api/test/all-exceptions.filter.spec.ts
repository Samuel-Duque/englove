import { describe, it, expect, vi } from 'vitest';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { ConflictException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

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
});
