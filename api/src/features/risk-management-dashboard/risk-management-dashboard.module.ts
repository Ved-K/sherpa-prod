import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RiskManagementDashboardController } from './risk-management-dashboard.controller';
import { RiskManagementDashboardService } from './risk-management-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [RiskManagementDashboardController],
  providers: [RiskManagementDashboardService],
})
export class RiskManagementDashboardModule {}
