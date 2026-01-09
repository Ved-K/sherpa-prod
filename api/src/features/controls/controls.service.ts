import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionCategoriesService } from '../action-categories/action-categories.service';

@Injectable()
export class ControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: ActionCategoriesService,
  ) {}

  private async ensureAssessment(assessmentId: string) {
    const a = await this.prisma.stepHazardAssessment.findUnique({
      where: { id: assessmentId },
    });
    if (!a) throw new NotFoundException('Assessment not found');
    return a;
  }

  async listForAssessment(
    assessmentId: string,
    phase?: 'EXISTING' | 'ADDITIONAL',
  ) {
    await this.ensureAssessment(assessmentId);

    return this.prisma.assessmentControl.findMany({
      where: { assessmentId, ...(phase ? { phase } : {}) },
      orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }],
      include: { category: true },
    });
  }

  async createForAssessment(
    assessmentId: string,
    data: {
      phase: 'EXISTING' | 'ADDITIONAL';
      type: 'ENGINEERING' | 'ADMIN' | 'PPE' | 'OTHER';
      description: string;
      categoryId?: string | null;
      owner?: string;
      dueDate?: string;
      isVerified?: boolean;
    },
  ) {
    await this.ensureAssessment(assessmentId);

    const description = (data.description ?? '').trim();
    if (!description) throw new BadRequestException('description required');

    // Enforce category for recommended actions (ADDITIONAL)
    const categoryId = data.categoryId ?? null;
    if (data.phase === 'ADDITIONAL' && !categoryId) {
      throw new BadRequestException(
        'categoryId required for ADDITIONAL controls',
      );
    }
    if (categoryId) await this.categories.ensureExists(categoryId);

    const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;

    return this.prisma.assessmentControl.create({
      data: {
        assessmentId,
        phase: data.phase,
        type: data.type,
        description,
        categoryId: categoryId ?? undefined,
        owner: data.owner,
        dueDate,
        isVerified:
          typeof data.isVerified === 'boolean' ? data.isVerified : false,
      },
      include: { category: true },
    });
  }

  async update(
    id: string,
    patch: {
      phase?: 'EXISTING' | 'ADDITIONAL';
      type?: 'ENGINEERING' | 'ADMIN' | 'PPE' | 'OTHER';
      description?: string;
      categoryId?: string | null;
      owner?: string | null;
      dueDate?: string | null;
      isVerified?: boolean;
    },
  ) {
    const existing = await this.prisma.assessmentControl.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Control not found');

    const nextPhase = patch.phase ?? existing.phase;
    const nextCategoryId =
      patch.categoryId === undefined ? existing.categoryId : patch.categoryId;

    if (nextPhase === 'ADDITIONAL' && !nextCategoryId) {
      throw new BadRequestException(
        'categoryId required for ADDITIONAL controls',
      );
    }
    if (nextCategoryId) await this.categories.ensureExists(nextCategoryId);

    const data: any = {};
    if (patch.phase) data.phase = patch.phase;
    if (patch.type) data.type = patch.type;
    if (typeof patch.description === 'string') {
      const d = patch.description.trim();
      if (!d) throw new BadRequestException('description cannot be blank');
      data.description = d;
    }
    if (patch.categoryId !== undefined) data.categoryId = patch.categoryId;
    if (patch.owner !== undefined) data.owner = patch.owner;
    if (patch.dueDate !== undefined)
      data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    if (typeof patch.isVerified === 'boolean')
      data.isVerified = patch.isVerified;

    return this.prisma.assessmentControl.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.assessmentControl.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Control not found');
    return this.prisma.assessmentControl.delete({ where: { id } });
  }
}
