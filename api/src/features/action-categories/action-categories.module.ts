import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActionCategoriesController } from './action-categories.controller';
import { ActionCategoriesService } from './action-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [ActionCategoriesController],
  providers: [ActionCategoriesService],
  exports: [ActionCategoriesService],
})
export class ActionCategoriesModule {}
