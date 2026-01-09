import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TaskCategoriesController } from './task-categories.controller';
import { TaskCategoriesService } from './task-categories.service';
import { TaskPhasesController } from './task-phases.controller';
import { TaskPhasesService } from './task-phases.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaskCategoriesController, TaskPhasesController],
  providers: [TaskCategoriesService, TaskPhasesService],
})
export class TaskMetaModule {}
