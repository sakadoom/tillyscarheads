import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { prisma } from '../db.js';
import { ApiError } from './error.js';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

/** Memverifikasi token Bearer dan memastikan akunnya masih ada. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }

  const token = header.slice('Bearer '.length).trim();
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.');
  }

  const userId = typeof payload === 'string' ? '' : String(payload.sub ?? '');
  if (!userId) throw ApiError.unauthorized('Token tidak memuat identitas pengguna.');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw ApiError.unauthorized('Akun tidak ditemukan.');

  (req as AuthenticatedRequest).userId = user.id;
  next();
}

/** Identitas pengguna dari sesi yang sudah diverifikasi (bukan dari input client). */
export function currentUserId(req: Request): string {
  const userId = (req as AuthenticatedRequest).userId;
  if (!userId) throw ApiError.unauthorized();
  return userId;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
