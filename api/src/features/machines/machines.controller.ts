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
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MachinesService } from './machines.service';

const actorFromReq = (req: Request) =>
  (req.headers['x-actor'] as string) || 'anonymous';

class CreateMachineDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

class UpdateMachineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

class UpdateStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

@ApiTags('Machines')
@Controller()
export class MachinesController {
  constructor(private readonly svc: MachinesService) {}

  @Get('lines/:lineId/machines')
  listForLine(@Param('lineId') lineId: string) {
    return this.svc.listForLine(lineId);
  }

  @Post('lines/:lineId/machines')
  createForLine(
    @Param('lineId') lineId: string,
    @Body() dto: CreateMachineDto,
  ) {
    return this.svc.createForLine(lineId, dto.name);
  }

  @Get('machines/:machineId')
  get(@Param('machineId') machineId: string) {
    return this.svc.get(machineId);
  }

  @Patch('machines/:machineId')
  update(
    @Param('machineId') machineId: string,
    @Body() dto: UpdateMachineDto,
    @Req() req: Request,
  ) {
    return this.svc.update(machineId, dto, actorFromReq(req));
  }

  @Patch('machines/:machineId/status')
  setStatus(
    @Param('machineId') machineId: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: Request,
  ) {
    return this.svc.setStatus(machineId, dto.status, actorFromReq(req));
  }

  @Delete('machines/:machineId')
  remove(@Param('machineId') machineId: string, @Req() req: Request) {
    return this.svc.remove(machineId, actorFromReq(req));
  }
}
