import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Error yang dikembalikan API dengan format { error: { code, message, details } }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Anda harus masuk terlebih dahulu.'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static notFound(message = 'Data tidak ditemukan.'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(code: string, message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(422, code, message, details);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
        details: { fields: error.flatten().fieldErrors },
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Data dengan nilai tersebut sudah ada.' },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan.' } });
      return;
    }
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Isi permintaan bukan JSON yang valid.' } });
    return;
  }

  console.error('Kesalahan tak terduga pada server:', error);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' } });
}
