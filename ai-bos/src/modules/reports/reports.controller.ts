import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  getRevenue(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    const numDays = days ? parseInt(days, 10) : 30;
    return this.reportsService.getRevenueOverTime(user.tenantId, numDays);
  }

  @Get('customer-sources')
  getCustomerSources(@CurrentUser() user: JwtPayload) {
    return this.reportsService.getCustomerSourceBreakdown(user.tenantId);
  }

  @Get('technician-performance')
  getTechnicianPerformance(@CurrentUser() user: JwtPayload) {
    return this.reportsService.getTechnicianPerformance(user.tenantId);
  }
}
