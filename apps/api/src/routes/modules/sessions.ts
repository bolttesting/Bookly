import { Router } from 'express';

import { prisma } from '../../config/prisma.js';

const sessionsRouter = Router();

sessionsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.delete('/:sessionId', async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { sessionId } = req.params;
    await prisma.session.delete({
      where: {
        id: sessionId,
        userId: req.user.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { sessionsRouter };

