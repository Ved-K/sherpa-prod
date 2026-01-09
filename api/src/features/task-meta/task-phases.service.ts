import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskPhasesService {
  constructor(private readonly prisma: PrismaService) {}

  list(onlyActive = false) {
    return this.prisma.taskPhase.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(name: string, sortOrder?: number) {
    const n = (name ?? '').trim();
    if (!n) throw new BadRequestException('name required');

    return this.prisma.taskPhase.create({
      data: { name: n, sortOrder: sortOrder ?? 0, isActive: true },
    });
  }

  async update(
    id: string,
    data: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const existing = await this.prisma.taskPhase.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('taskPhase not found');

    return this.prisma.taskPhase.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        sortOrder:
          typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
        isActive:
          typeof data.isActive === 'boolean' ? data.isActive : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.taskPhase.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('taskPhase not found');

    // If referenced by tasks, "delete" should be safe → deactivate instead.
    const usedCount = await this.prisma.task.count({
      where: { phaseId: id },
    });
    if (usedCount > 0) {
      return this.prisma.taskPhase.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.taskPhase.delete({ where: { id } });
  }
}
