import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
