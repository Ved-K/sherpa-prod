// risk-management-dashboard.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { RiskManagementDashboardService } from './risk-management-dashboard.service';

type DotColor = 'gray' | 'green' | 'yellow' | 'orange' | 'red';
const DOTS: DotColor[] = ['gray', 'green', 'yellow', 'orange', 'red'];

function parseDot(dot?: string): DotColor | undefined {
  if (!dot) return undefined;
  if (DOTS.includes(dot as DotColor)) return dot as DotColor;
  throw new BadRequestException(`Invalid dot filter: ${dot}`);
}

function parseLimit(limit?: string): number | undefined {
  if (!limit) return undefined;
  const n = Number(limit);
  if (!Number.isFinite(n))
    throw new BadRequestException(`Invalid limit: ${limit}`);
  return n;
}

@Controller('risk')
export class RiskManagementDashboardController {
  constructor(private readonly svc: RiskManagementDashboardService) {}

  @Get('meta')
  meta() {
    return this.svc.meta();
  }

  @Get('lines')
  lines() {
    return this.svc.lines();
  }

  @Get('lines/:lineId/machines')
  machines(@Param('lineId') lineId: string) {
    return this.svc.machines(lineId);
  }

  @Get('machines/:machineId/tasks')
  tasks(
    @Param('machineId') machineId: string,
    @Query('taskCategoryId') taskCategoryId?: string,
    @Query('taskPhaseId') taskPhaseId?: string,
  ) {
    return this.svc.tasks(machineId, { taskCategoryId, taskPhaseId });
  }

  @Get('tasks/:taskId/steps')
  steps(
    @Param('taskId') taskId: string,
    @Query('dot') dot?: string,
    @Query('actionCategoryId') actionCategoryId?: string,
  ) {
    return this.svc.steps(taskId, {
      dot: parseDot(dot),
      actionCategoryId,
    });
  }

  @Get('recommendations')
  recommendations(
    @Query('lineId') lineId?: string,
    @Query('machineId') machineId?: string,
    @Query('taskId') taskId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.recommendations({
      lineId,
      machineId,
      taskId,
      limit: parseLimit(limit),
    });
  }

  @Patch('controls/:controlId/implemented')
  setImplemented(
    @Param('controlId') controlId: string,
    @Body() body: { implemented: boolean; actor?: string },
  ) {
    return this.svc.setControlImplemented(
      controlId,
      body.implemented,
      body.actor,
    );
  }
}
