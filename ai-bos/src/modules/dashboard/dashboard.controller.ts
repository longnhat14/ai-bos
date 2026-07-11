import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getOverview(user.tenantId);
  }

  @Get('technician-workload')
  getTechnicianWorkload(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getTechnicianWorkload(user.tenantId);
  }
}
