import type { Request } from 'express';

import { ApiError } from '../middleware/error.js';

/**
 * Mengambil parameter path yang wajib berupa satu string. Tipe `req.params`
 * Express adalah `string | string[]`, jadi nilainya diperiksa dahulu agar tidak
 * ada id yang diam-diam berubah bentuk.
 */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw ApiError.badRequest(`Parameter "${name}" pada alamat permintaan tidak valid.`);
  }
  return value;
}
