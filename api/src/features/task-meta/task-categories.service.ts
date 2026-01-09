import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(onlyActive = false) {
    return this.prisma.taskCategory.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(name: string, sortOrder?: number) {
    const n = (name ?? '').trim();
    if (!n) throw new BadRequestException('name required');

    return this.prisma.taskCategory.create({
      data: { name: n, sortOrder: sortOrder ?? 0, isActive: true },
    });
  }

  async update(
    id: string,
    data: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const existing = await this.prisma.taskCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('TaskCategory not found');

    return this.prisma.taskCategory.update({
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
    const existing = await this.prisma.taskCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('TaskCategory not found');

    // If referenced by tasks, "delete" should be safe → deactivate instead.
    const usedCount = await this.prisma.task.count({
      where: { categoryId: id },
    });
    if (usedCount > 0) {
      return this.prisma.taskCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.taskCategory.delete({ where: { id } });
  }
}
