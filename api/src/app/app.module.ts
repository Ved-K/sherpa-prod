import { PrismaModule } from '../prisma/prisma.module';

import { LinesModule } from '../features/lines/lines.module';
import { MachinesModule } from '../features/machines/machines.module';
import { TasksModule } from '../features/tasks/tasks.module';
import { StepsModule } from '../features/steps/steps.module';
import { HazardsModule } from '../features/hazards/hazards.module';
import { AssessmentsModule } from '../features/assessments/assessments.module';
import { ControlsModule } from '../features/controls/controls.module';
import { AuditModule } from '../features/audit/audit.module';

import { ChangeRequestsModule } from '../features/change-requests/change-requests.module';
import { ReportsModule } from '../features/reports/reports.module';
import { UsersModule } from '../features/users/users.module';
import { ExportsModule } from '../features/exports/exports.module';
import { DashboardModule } from '../features/dashboard/dashboard.module';
import { ActionCategoriesModule } from '../features/action-categories/action-categories.module';

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserContextMiddleware } from '../common/user-content.middleware';
import { RiskManagementDashboardModule } from '../features/risk-management-dashboard/risk-management-dashboard.module';

@Module({
  imports: [
    PrismaModule,
    LinesModule,
    MachinesModule,
    TasksModule,
    StepsModule,
    HazardsModule,
    AssessmentsModule,
    ControlsModule,
    AuditModule,
    ChangeRequestsModule,
    ReportsModule,
    UsersModule,
    ExportsModule,
    DashboardModule,
    ActionCategoriesModule,
    RiskManagementDashboardModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserContextMiddleware).forRoutes('*');
  }
}
