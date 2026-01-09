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
import { LinesService } from './lines.service';

const actorFromReq = (req: Request) =>
  (req.headers['x-actor'] as string) || 'anonymous';

class CreateLineDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

class UpdateLineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

class UpdateStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

@ApiTags('Lines')
@Controller('lines')
export class LinesController {
  constructor(private readonly svc: LinesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateLineDto) {
    return this.svc.create(dto.name);
  }

  @Get(':lineId')
  get(@Param('lineId') lineId: string) {
    return this.svc.get(lineId);
  }

  @Get(':lineId/tree')
  tree(@Param('lineId') lineId: string) {
    return this.svc.getTree(lineId);
  }

  @Patch(':lineId')
  update(
    @Param('lineId') lineId: string,
    @Body() dto: UpdateLineDto,
    @Req() req: Request,
  ) {
    return this.svc.update(lineId, dto, actorFromReq(req));
  }

  @Patch(':lineId/status')
  setStatus(
    @Param('lineId') lineId: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: Request,
  ) {
    return this.svc.setStatus(lineId, dto.status, actorFromReq(req));
  }

  @Delete(':lineId')
  remove(@Param('lineId') lineId: string, @Req() req: Request) {
    return this.svc.remove(lineId, actorFromReq(req));
  }
}
