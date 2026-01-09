import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CloneService } from './clone.service';

const actorFromReq = (req: Request) =>
  (req.headers['x-actor'] as string) || 'anonymous';

class CloneTaskDto {
  @IsString()
  targetMachineId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  resetStatus?: boolean;
}

class CloneMachineDto {
  @IsString()
  targetLineId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  resetStatus?: boolean;
}

class CloneLineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  resetStatus?: boolean;
}

@ApiTags('Clone')
@Controller()
export class CloneController {
  constructor(private readonly svc: CloneService) {}

  @Post('tasks/:taskId/clone')
  cloneTask(
    @Param('taskId') taskId: string,
    @Body() dto: CloneTaskDto,
    @Req() req: Request,
  ) {
    return this.svc.cloneTask(
      taskId,
      dto.targetMachineId,
      dto.name,
      dto.resetStatus ?? true,
      actorFromReq(req),
    );
  }

  @Post('machines/:machineId/clone')
  cloneMachine(
    @Param('machineId') machineId: string,
    @Body() dto: CloneMachineDto,
    @Req() req: Request,
  ) {
    return this.svc.cloneMachine(
      machineId,
      dto.targetLineId,
      dto.name,
      dto.resetStatus ?? true,
      actorFromReq(req),
    );
  }

  @Post('lines/:lineId/clone')
  cloneLine(
    @Param('lineId') lineId: string,
    @Body() dto: CloneLineDto,
    @Req() req: Request,
  ) {
    return this.svc.cloneLine(
      lineId,
      dto.name,
      dto.resetStatus ?? true,
      actorFromReq(req),
    );
  }
}
