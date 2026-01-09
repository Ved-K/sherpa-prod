import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  shouldAudit(status?: ReviewStatus | null) {
    return status === ReviewStatus.REVIEWED || status === ReviewStatus.FINAL;
  }

  async log(params: {
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    actor?: string;
    before?: unknown;
    after?: unknown;
    meta?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actor: params.actor,
        before: (params.before as any) ?? null,
        after: (params.after as any) ?? null,
        meta: (params.meta as any) ?? null,
      },
    });
  }
}
