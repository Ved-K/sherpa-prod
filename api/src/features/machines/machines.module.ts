import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [MachinesController],
  providers: [MachinesService],
})
export class MachinesModule {}
