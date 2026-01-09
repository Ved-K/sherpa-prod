// api/src/prisma/prisma.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaProdService } from './prisma.prod.service';

@Module({
  providers: [PrismaService, PrismaProdService],
  exports: [PrismaService, PrismaProdService],
})
export class PrismaModule {}
