import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { InvoiceService } from './invoice.service';

@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard)
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

  @Patch(':id/mark-paid')
  markPaid(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.invoiceService.markPaid(user.tenantId, id);
  }
}
