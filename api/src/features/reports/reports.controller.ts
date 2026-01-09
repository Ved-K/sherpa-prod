import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('lines')
  lines() {
    return this.service.linesOverview();
  }

  @Get('lines/:lineId/machines')
  machines(@Param('lineId') lineId: string) {
    return this.service.machinesForLine(lineId);
  }

  @Get('machines/:machineId/tasks')
  tasks(
    @Param('machineId') machineId: string,
    @Query('trained') trained?: string,
  ) {
    return this.service.tasksForMachine(machineId, trained);
  }

  @Get('tasks/:taskId/steps')
  steps(@Param('taskId') taskId: string) {
    return this.service.stepsForTask(taskId);
  }
}
