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
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AssessmentsService } from './assessments.service';

const actorFromReq = (req: Request) =>
  (req.headers['x-actor'] as string) || 'anonymous';

class CreateAssessmentDto {
  @IsString()
  hazardId!: string;
}

class BulkCreateAssessmentDto {
  @IsArray()
  hazardIds!: string[];
}

class UpdateAssessmentDto {
  @IsOptional() @IsString() unsafeConditions?: string;
  @IsOptional() @IsString() unsafeActs?: string;
  @IsOptional() @IsString() potentialHarm?: string;

  @IsOptional() @IsInt() @Min(1) @Max(5) existingSeverity?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) existingProbability?: number;

  @IsOptional() @IsInt() @Min(1) @Max(5) newSeverity?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) newProbability?: number;

  @IsOptional() @IsString() notes?: string;
}

class UpdateStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

@ApiTags('Assessments')
@Controller()
export class AssessmentsController {
  constructor(private readonly svc: AssessmentsService) {}

  @Get('steps/:stepId/assessments')
  listForStep(@Param('stepId') stepId: string) {
    return this.svc.listForStep(stepId);
  }

  @Post('steps/:stepId/assessments')
  attach(@Param('stepId') stepId: string, @Body() dto: CreateAssessmentDto) {
    return this.svc.attachHazard(stepId, dto.hazardId);
  }

  @Post('steps/:stepId/assessments/bulk')
  bulk(@Param('stepId') stepId: string, @Body() dto: BulkCreateAssessmentDto) {
    return this.svc.bulkAttach(stepId, dto.hazardIds);
  }

  @Patch('assessments/:assessmentId')
  update(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpdateAssessmentDto,
    @Req() req: Request,
  ) {
    return this.svc.update(assessmentId, dto, actorFromReq(req));
  }

  @Patch('assessments/:assessmentId/status')
  setStatus(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: Request,
  ) {
    return this.svc.setStatus(assessmentId, dto.status, actorFromReq(req));
  }

  @Delete('assessments/:assessmentId')
  remove(@Param('assessmentId') assessmentId: string, @Req() req: Request) {
    return this.svc.remove(assessmentId, actorFromReq(req));
  }
}
