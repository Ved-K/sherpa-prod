import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ReviewStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto';

const actorFromReq = (req: Request) =>
  (req.headers['x-actor'] as string) || 'anonymous';

class UpdateStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

@ApiTags('Tasks')
@Controller()
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get('machines/:machineId/tasks')
  listForMachine(@Param('machineId') machineId: string) {
    return this.svc.listForMachine(machineId);
  }

  @Post('machines/:machineId/tasks')
  createForMachine(
    @Param('machineId') machineId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.svc.createForMachine(
      machineId,
      dto.name,
      dto.description,
      dto.trainingLink,
      dto.categoryId,
      dto.phaseId,
    );
  }

  @Get('tasks/:taskId')
  get(@Param('taskId') taskId: string) {
    return this.svc.get(taskId);
  }

  @Patch('tasks/:taskId')
  update(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: Request,
  ) {
    return this.svc.update(taskId, dto, actorFromReq(req));
  }

  @Patch('tasks/:taskId/status')
  setStatus(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: Request,
  ) {
    return this.svc.setStatus(taskId, dto.status, actorFromReq(req));
  }

  @Delete('tasks/:taskId')
  remove(@Param('taskId') taskId: string, @Req() req: Request) {
    return this.svc.remove(taskId, actorFromReq(req));
  }
}
