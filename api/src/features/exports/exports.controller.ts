import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Get('audit.xlsx')
  async auditXlsx(
    @Query('scope') scope: 'prod' | 'staging' = 'prod',
    @Res() res: Response,
  ) {
    const buf = await this.service.buildAuditWorkbook(scope);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sherpa_audit_${scope}.xlsx"`,
    );
    res.send(buf);
  }
}
