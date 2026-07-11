import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ConfirmDiagnosisDto } from './dto/diagnostic.dto';
import { DiagnosticService } from './diagnostic.service';

@Controller('api/v1/diagnostic')
@UseGuards(JwtAuthGuard)
export class DiagnosticController {
  constructor(private readonly diagnosticService: DiagnosticService) {}

  @Get(':ticketId')
  diagnose(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.diagnosticService.diagnose(user.tenantId, ticketId);
  }

  // Ky thuat vien xac nhan nguyen nhan dung thuc te -> tu dong nuoi Knowledge Base
  @Post(':ticketId/confirm')
  confirmDiagnosis(
    @CurrentUser() user: JwtPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: ConfirmDiagnosisDto,
  ) {
    return this.diagnosticService.confirmDiagnosis(user.tenantId, ticketId, dto);
  }
}
