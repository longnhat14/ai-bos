import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { DispatcherService } from './dispatcher.service';

@Controller('api/v1/dispatcher')
@UseGuards(JwtAuthGuard)
export class DispatcherController {
  constructor(private readonly dispatcherService: DispatcherService) {}

  // Che do Manual/Semi-Auto: chi de xuat, quan ly tu chon nguoi trong danh sach
  // (dung endpoint PATCH /api/v1/tickets/:id/assign da co san o Sprint 1 de giao that)
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

  // Che do Auto: AI tu dong giao viec cho nguoi diem cao nhat, khong can quan ly xac nhan
  @Post('auto-assign/:ticketId')
  autoAssign(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.dispatcherService.autoAssign(user.tenantId, ticketId);
  }
}
