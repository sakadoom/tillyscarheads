import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

import { ApiError } from './error.js';

/** Memvalidasi `req.body` dengan skema zod dan menggantinya dengan hasil parse. */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw ApiError.badRequest('Data yang dikirim tidak valid.', {
        fields: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data as z.infer<T>;
    next();
  };
}
