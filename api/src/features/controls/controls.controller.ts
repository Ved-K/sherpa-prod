import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ControlsService } from './controls.service';

@Controller()
export class ControlsController {
  constructor(private readonly svc: ControlsService) {}

  @Get('assessments/:assessmentId/controls')
  async listForAssessment(
    @Param('assessmentId') assessmentId: string,
    @Query('phase') phase?: 'EXISTING' | 'ADDITIONAL',
  ) {
    return this.svc.listForAssessment(assessmentId, phase);
  }

  @Post('assessments/:assessmentId/controls')
  async createForAssessment(
    @Param('assessmentId') assessmentId: string,
    @Body()
    body: {
      phase: 'EXISTING' | 'ADDITIONAL';
      type: 'ENGINEERING' | 'ADMIN' | 'PPE' | 'OTHER';
      description: string;
      categoryId?: string | null; // required for ADDITIONAL
      owner?: string;
      dueDate?: string; // ISO string
      isVerified?: boolean;
    },
  ) {
    return this.svc.createForAssessment(assessmentId, body);
  }

  @Patch('controls/:id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      phase?: 'EXISTING' | 'ADDITIONAL';
      type?: 'ENGINEERING' | 'ADMIN' | 'PPE' | 'OTHER';
      description?: string;
      categoryId?: string | null;
      owner?: string | null;
      dueDate?: string | null;
      isVerified?: boolean;
    },
  ) {
    return this.svc.update(id, body);
  }

  @Delete('controls/:id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
