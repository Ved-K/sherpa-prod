import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HazardsService } from './hazards.service';
import { HazardsController } from './hazards.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HazardsController],
  providers: [HazardsService],
})
export class HazardsModule {}
