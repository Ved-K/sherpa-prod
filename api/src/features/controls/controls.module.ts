import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActionCategoriesModule } from '../action-categories/action-categories.module';
import { ControlsController } from './controls.controller';
import { ControlsService } from './controls.service';

@Module({
  imports: [PrismaModule, ActionCategoriesModule],
  controllers: [ControlsController],
  providers: [ControlsService],
})
export class ControlsModule {}
