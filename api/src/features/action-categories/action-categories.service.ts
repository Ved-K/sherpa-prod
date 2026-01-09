import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActionCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts?: { activeOnly?: boolean }) {
    return this.prisma.actionCategory.findMany({
      where: opts?.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const cat = await this.prisma.actionCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('ActionCategory not found');
    return cat;
  }

  async ensureExists(id: string) {
    const cat = await this.prisma.actionCategory.findUnique({ where: { id } });
    if (!cat) throw new BadRequestException('Invalid categoryId');
    if (!cat.isActive) throw new BadRequestException('categoryId is inactive');
    return cat;
  }

  async create(data: {
    name: string;
    description?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const name = (data.name ?? '').trim();
    if (!name) throw new BadRequestException('name required');

    // Keep names human-readable but enforce uniqueness
    try {
      return await this.prisma.actionCategory.create({
        data: {
          name,
          description: data.description,
          color: data.color,
          sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
          isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
        },
      });
    } catch (e: any) {
      throw new BadRequestException('Category name must be unique');
    }
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    await this.get(id);

    const patch: any = {};
    if (typeof data.name === 'string') {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('name cannot be blank');
      patch.name = name;
    }
    if (typeof data.description === 'string')
      patch.description = data.description;
    if (typeof data.color === 'string') patch.color = data.color;
    if (typeof data.sortOrder === 'number') patch.sortOrder = data.sortOrder;
    if (typeof data.isActive === 'boolean') patch.isActive = data.isActive;

    try {
      return await this.prisma.actionCategory.update({
        where: { id },
        data: patch,
      });
    } catch (e: any) {
      throw new BadRequestException('Update failed (name may already exist)');
    }
  }

  async softDelete(id: string) {
    await this.get(id);
    return this.prisma.actionCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
