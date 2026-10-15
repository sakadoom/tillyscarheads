import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from 'shared';

import { config } from '../config.js';
import { prisma } from '../db.js';
import { currentUserId, requireAuth, signToken } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { toUserDto } from '../services/serialize.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict(
      'EMAIL_TAKEN',
      'Email sudah terdaftar. Silakan masuk atau gunakan email lain.',
    );
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });

  res.status(201).json({ token: signToken(user.id), user: toUserDto(user) });
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
  }

  res.json({ token: signToken(user.id), user: toUserDto(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUserId(req) } });
  res.json({ user: toUserDto(user) });
});
