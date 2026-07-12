import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { InvoiceService } from './invoice.service';

@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.invoiceService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.invoiceService.findOne(user.tenantId, id);
  }

  @Get('by-ticket/:ticketId')
  findByTicket(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.invoiceService.findByTicket(user.tenantId, ticketId);
  }

  // Hanh dong tai chinh (xac nhan da thu tien) - CHI Admin
  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN)
  markPaid(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.invoiceService.markPaid(user.tenantId, id);
  }
}
