import { Injectable, BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaProdService } from '../../prisma/prisma.prod.service';

@Injectable()
export class ExportsService {
  constructor(
    private readonly staging: PrismaService,
    private readonly prod: PrismaProdService,
  ) {}

  async buildAuditWorkbook(scope: 'prod' | 'staging') {
    const db = scope === 'prod' ? this.prod : this.staging;
    if (!db) throw new BadRequestException('DB not available');

    const [lines, machines, tasks, steps, assessments, controls, audit] =
      await Promise.all([
        db.line.findMany(),
        db.machine.findMany(),
        db.task.findMany(),
        db.step.findMany(),
        db.stepHazardAssessment.findMany(),
        db.assessmentControl.findMany(),
        db.auditLog.findMany({ orderBy: { at: 'desc' }, take: 5000 }),
      ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sherpa API';
    wb.created = new Date();

    addSheet(wb, 'Lines', lines);
    addSheet(wb, 'Machines', machines);
    addSheet(wb, 'Tasks', tasks);
    addSheet(wb, 'Steps', steps);
    addSheet(wb, 'Assessments', assessments);
    addSheet(wb, 'Controls', controls);
    addSheet(wb, 'AuditLog', audit);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}

function addSheet(wb: ExcelJS.Workbook, name: string, rows: any[]) {
  const ws = wb.addWorksheet(name);
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(12, h.length + 2),
  }));

  for (const r of rows) ws.addRow(flattenRow(r));
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: 'A1', to: `${col(headers.length)}1` };
}

function flattenRow(r: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(r)) {
    out[k] =
      v instanceof Date
        ? v.toISOString()
        : typeof v === 'object' && v !== null
          ? JSON.stringify(v)
          : v;
  }
  return out;
}

function col(n: number) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
