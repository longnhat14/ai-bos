import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Chi Admin duoc xem doanh thu - du lieu tai chinh nhay cam, Technician khong can biet
  @Get('overview')
  @Roles(UserRole.ADMIN)
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getOverview(user.tenantId);
  }

  // Ca Admin va Technician deu xem duoc khoi luong cong viec (huu ich cho ca 2)
  @Get('technician-workload')
  getTechnicianWorkload(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getTechnicianWorkload(user.tenantId);
  }
}
