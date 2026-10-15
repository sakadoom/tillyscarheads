import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { analysisRouter } from './analysis.js';
import { assignmentsRouter } from './assignments.js';
import { authRouter } from './auth.js';
import { calendarRouter } from './calendar.js';
import { dependenciesRouter } from './dependencies.js';
import { projectsRouter } from './projects.js';
import { resourcesRouter } from './resources.js';
import { tasksRouter } from './tasks.js';

/** Membatasi percobaan masuk/daftar sebelum verifikasi password yang mahal. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.',
      },
    });
  },
});

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Rute publik: hanya cek kesehatan dan autentikasi.
apiRouter.use('/auth', authLimiter, authRouter);

// Semua rute di bawah ini wajib memakai sesi yang sah. Autentikasi dipasang
// sekali di sini supaya tidak ada router yang bisa lupa melindungi dirinya.
apiRouter.use(requireAuth);

apiRouter.use(projectsRouter);
apiRouter.use(tasksRouter);
apiRouter.use(dependenciesRouter);
apiRouter.use(resourcesRouter);
apiRouter.use(assignmentsRouter);
apiRouter.use(calendarRouter);
apiRouter.use(analysisRouter);
