// src/features/controls/controls.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionCategoriesService } from '../action-categories/action-categories.service';
import { ControlStatus } from '@prisma/client';

function isVerified(control: {
  status: ControlStatus;
  verifiedAt: Date | null;
}) {
  return control.status === 'VERIFIED' || !!control.verifiedAt;
}

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

    const rows = await this.prisma.assessmentControl.findMany({
      where: { assessmentId, ...(phase ? { phase } : {}) },
      orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }],
      include: { category: true },
    });

    // ✅ add computed field for UI
    return rows.map((r) => ({ ...r, isVerified: isVerified(r) }));
  }

  async createForAssessment(
    assessmentId: string,
    data: {
      phase: 'EXISTING' | 'ADDITIONAL';
      type: 'ENGINEERING' | 'ADMIN' | 'PPE' | 'OTHER';
      description: string;
      categoryId?: string | null; // required for ADDITIONAL
      owner?: string;
      dueDate?: string; // ISO string
      isVerified?: boolean; // keep as API input, but don't store directly
      status?: ControlStatus; // optional advanced usage
    },
  ) {
    await this.ensureAssessment(assessmentId);

    const description = (data.description ?? '').trim();
    if (!description) throw new BadRequestException('description required');

    const categoryId = data.categoryId ?? null;
    if (categoryId) await this.categories.ensureExists(categoryId);

    if (data.phase !== 'ADDITIONAL' && data.dueDate !== undefined) {
      throw new BadRequestException(
        'dueDate is only allowed for ADDITIONAL controls',
      );
    }

    const dueDate =
      data.phase === 'ADDITIONAL'
        ? data.dueDate
          ? new Date(data.dueDate)
          : undefined
        : undefined;

    const now = new Date();
    const nextStatus: ControlStatus =
      data.isVerified === true ? 'VERIFIED' : (data.status ?? 'OPEN');

    const created = await this.prisma.assessmentControl.create({
      data: {
        assessmentId,
        phase: data.phase,
        type: data.type,
        description,
        categoryId: categoryId ?? undefined,
        owner: data.owner,
        dueDate,

        // ✅ store real fields
        status: nextStatus,
        verifiedAt: nextStatus === 'VERIFIED' ? now : undefined,
      },
      include: { category: true },
    });

    return { ...created, isVerified: isVerified(created) };
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

      // ✅ API-level toggles
      isVerified?: boolean;
      status?: ControlStatus;

      // optional fields you already have in Prisma:
      completedAt?: string | null;
      completedBy?: string | null;
      evidenceUrl?: string | null;
      verifiedAt?: string | null; // if you ever want to set explicitly
    },
  ) {
    const existing = await this.prisma.assessmentControl.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Control not found');

    const nextPhase = patch.phase ?? existing.phase;

    if (nextPhase !== 'ADDITIONAL' && patch.dueDate !== undefined) {
      throw new BadRequestException(
        'dueDate is only allowed for ADDITIONAL controls',
      );
    }

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

    if (patch.completedAt !== undefined)
      data.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
    if (patch.completedBy !== undefined) data.completedBy = patch.completedBy;
    if (patch.evidenceUrl !== undefined) data.evidenceUrl = patch.evidenceUrl;

    // ✅ status + verification mapping
    // Priority: explicit isVerified toggle > explicit status > existing
    if (typeof patch.isVerified === 'boolean') {
      if (patch.isVerified) {
        data.status = 'VERIFIED';
        data.verifiedAt = new Date();
      } else {
        // un-verify: drop to IMPLEMENTED if it was verified, else leave as-is
        data.status =
          existing.status === 'VERIFIED' ? 'IMPLEMENTED' : existing.status;
        data.verifiedAt = null;
      }
    } else if (patch.status) {
      data.status = patch.status;
      if (patch.status === 'VERIFIED') data.verifiedAt = new Date();
    }

    if (patch.verifiedAt !== undefined) {
      data.verifiedAt = patch.verifiedAt ? new Date(patch.verifiedAt) : null;
      if (data.verifiedAt && !data.status) data.status = 'VERIFIED';
    }

    const updated = await this.prisma.assessmentControl.update({
      where: { id },
      data,
      include: { category: true },
    });

    return { ...updated, isVerified: isVerified(updated) };
  }

  async remove(id: string) {
    const existing = await this.prisma.assessmentControl.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Control not found');
    return this.prisma.assessmentControl.delete({ where: { id } });
  }
}
