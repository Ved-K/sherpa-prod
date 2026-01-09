import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type RequestUser = {
  id?: string;
  email?: string;
  role?: 'ADMIN' | 'USER';
  isActive?: boolean;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as any).user ?? {};
  },
);
