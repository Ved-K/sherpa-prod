import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StepsController } from './steps.controller';
import { StepsService } from './steps.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [StepsController],
  providers: [StepsService],
})
export class StepsModule {}
