import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMe(email: string) {
    return this.prisma.appUser.upsert({
      where: { email },
      create: { email, role: 'USER' as any, isActive: true },
      update: {},
    });
  }

  async list() {
    return this.prisma.appUser.findMany({ orderBy: { email: 'asc' } });
  }

  async create(data: {
    email: string;
    displayName?: string;
    role?: 'ADMIN' | 'USER';
  }) {
    if (!data.email) throw new BadRequestException('email required');
    return this.prisma.appUser.create({
      data: {
        email: data.email.toLowerCase(),
        displayName: data.displayName,
        role: (data.role ?? 'USER') as any,
      },
    });
  }

  async update(
    id: string,
    data: { displayName?: string; role?: 'ADMIN' | 'USER'; isActive?: boolean },
  ) {
    const existing = await this.prisma.appUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prisma.appUser.update({
      where: { id },
      data: {
        displayName: data.displayName,
        role: data.role ? (data.role as any) : undefined,
        isActive:
          typeof data.isActive === 'boolean' ? data.isActive : undefined,
      },
    });
  }
}
