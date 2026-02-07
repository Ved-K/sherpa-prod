import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ControlsService } from './controls.service';
import { ControlPhase, CreateControlDto, UpdateControlDto } from './dto';

@Controller()
export class ControlsController {
  constructor(private readonly svc: ControlsService) {}

  @Get('assessments/:assessmentId/controls')
  async listForAssessment(
    @Param('assessmentId', new ParseUUIDPipe({ version: '4' }))
    assessmentId: string,
    @Query('phase', new ParseEnumPipe(ControlPhase, { optional: true }))
    phase?: ControlPhase,
  ) {
    return this.svc.listForAssessment(assessmentId, phase);
  }

  @Post('assessments/:assessmentId/controls')
  async createForAssessment(
    @Param('assessmentId', new ParseUUIDPipe({ version: '4' }))
    assessmentId: string,
    @Body() body: CreateControlDto,
  ) {
    return this.svc.createForAssessment(assessmentId, body);
  }

  @Patch('controls/:id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateControlDto,
  ) {
    return this.svc.update(id, body);
  }

  @Delete('controls/:id')
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.svc.remove(id);
  }
}
