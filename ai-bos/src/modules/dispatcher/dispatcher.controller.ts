import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { DispatcherService } from './dispatcher.service';

@Controller('api/v1/dispatcher')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatcherController {
  constructor(private readonly dispatcherService: DispatcherService) {}

  // Che do Manual/Semi-Auto: chi de xuat, mo cho ca KTV xem (vd tu tim nguoi ho tro phu)
  @Get('suggest/:ticketId')
  suggest(
    @CurrentUser() user: JwtPayload,
    @Param('ticketId') ticketId: string,
    @Query('limit') limit?: string,
  ) {
    return this.dispatcherService.suggestTechnicians(
      user.tenantId,
      ticketId,
      limit ? parseInt(limit, 10) : 3,
    );
  }

  // Che do Auto: tu dong giao viec khong can xac nhan - day la quyet dinh quan ly, CHI Admin
  @Post('auto-assign/:ticketId')
  @Roles(UserRole.ADMIN)
  autoAssign(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.dispatcherService.autoAssign(user.tenantId, ticketId);
  }
}
