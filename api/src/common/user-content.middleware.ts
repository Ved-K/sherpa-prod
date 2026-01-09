import { Injectable, ForbiddenException, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export type RequestUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
};

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const raw =
      (req.headers['x-actor'] as string) ||
      (req.headers['x-user-email'] as string) ||
      '';

    const email = raw.trim().toLowerCase();

    if (!email) {
      // Let public routes work; controllers that require identity will throw
      return next();
    }

    const dbUser = await this.prisma.appUser.upsert({
      where: { email },
      create: { email, role: 'USER', isActive: true },
      update: {},
    });

    if (!dbUser.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      isActive: dbUser.isActive,
    };

    next();
  }
}
