import { Controller, Get, Param, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DotColor } from './types';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('lines')
  async lines() {
    return this.dashboard.getLinesDashboard();
  }

  @Get('lines/:lineId/machines')
  async machinesForLine(@Param('lineId') lineId: string) {
    return this.dashboard.getMachinesDashboard(lineId);
  }

  @Get('machines/:machineId/tasks')
  async tasksForMachine(@Param('machineId') machineId: string) {
    return this.dashboard.getTasksDashboard(machineId);
  }

  @Get('tasks/:taskId/steps')
  async stepsForTask(
    @Param('taskId') taskId: string,
    @Query('dot') dot?: DotColor,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.dashboard.getStepsDashboard(taskId, { dot, categoryId });
  }
}
