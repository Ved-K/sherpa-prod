import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HazardsService {
  constructor(private prisma: PrismaService) {}

  listCategoriesWithHazards() {
    return this.prisma.hazardCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        hazards: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      },
    });
  }

  async createCategory(name: string, sortOrder = 0) {
    return this.prisma.hazardCategory.create({ data: { name, sortOrder } });
  }

  async createHazard(data: {
    categoryId: string;
    code?: string;
    name: string;
    description?: string;
    sortOrder?: number;
    active?: boolean;
  }) {
    const cat = await this.prisma.hazardCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!cat) throw new NotFoundException('Hazard category not found');

    return this.prisma.hazard.create({
      data: {
        categoryId: data.categoryId,
        code: data.code,
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
        active: data.active ?? true,
      },
    });
  }

  listHazards(params: { categoryId?: string; q?: string }) {
    const { categoryId, q } = params;
    return this.prisma.hazard.findMany({
      where: {
        active: true,
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
