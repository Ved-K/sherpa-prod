import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CloneController } from './clone.controller';
import { CloneService } from './clone.service';

@Module({
  imports: [AuditModule],
  controllers: [CloneController],
  providers: [CloneService],
})
export class CloneModule {}
