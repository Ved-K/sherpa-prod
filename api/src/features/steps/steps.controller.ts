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
import { StepsService } from './steps.service';
import { CreateStepDto, UpdateStepDto, UpdateStatusDto } from './dto';
import { BulkCreateStepsDto } from './bulk.dto';

const actorFromReq = (req: Request) =>
  (req.headers['x-actor'] as string) || 'anonymous';

@ApiTags('Steps')
@Controller()
export class StepsController {
  constructor(private readonly svc: StepsService) {}

  @Get('tasks/:taskId/steps')
  listForTask(@Param('taskId') taskId: string) {
    return this.svc.listForTask(taskId);
  }

  @Post('tasks/:taskId/steps')
  createForTask(@Param('taskId') taskId: string, @Body() dto: CreateStepDto) {
    return this.svc.createForTask(
      taskId,
      dto.title,
      dto.method,
      dto.stepNo,
      dto.trainingLink,
    );
  }

  @Post('tasks/:taskId/steps/bulk')
  bulk(@Param('taskId') taskId: string, @Body() dto: BulkCreateStepsDto) {
    return this.svc.bulkCreateForTask(taskId, dto.steps);
  }

  @Get('steps/:stepId')
  get(@Param('stepId') stepId: string) {
    return this.svc.get(stepId);
  }

  @Patch('steps/:stepId')
  update(
    @Param('stepId') stepId: string,
    @Body() dto: UpdateStepDto,
    @Req() req: Request,
  ) {
    return this.svc.update(stepId, dto, actorFromReq(req));
  }

  @Patch('steps/:stepId/status')
  setStatus(
    @Param('stepId') stepId: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: Request,
  ) {
    return this.svc.setStatus(stepId, dto.status, actorFromReq(req));
  }

  @Delete('steps/:stepId')
  remove(@Param('stepId') stepId: string, @Req() req: Request) {
    return this.svc.remove(stepId, actorFromReq(req));
  }
}
