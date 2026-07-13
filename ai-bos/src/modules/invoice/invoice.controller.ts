import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { TicketsService } from '../tickets/tickets.service';
import { UserRole } from '../users/user.entity';
import { CreateInvoiceManualDto } from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';

@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly ticketsService: TicketsService,
  ) {}

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

  // Tao hoa don THU CONG - dung khi ticket dong ma CHUA TUNG duoc bao gia nen
  // khong tu dong sinh hoa don duoc (xem InvoiceEventHandler - bo qua neu
  // finalPrice null), hoac can dieu chinh gia cuoi khac voi bao gia ban dau.
  // CHI Admin - day la hanh dong tai chinh.
  @Post('manual/:ticketId')
  @Roles(UserRole.ADMIN)
  async createManual(
    @CurrentUser() user: JwtPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateInvoiceManualDto,
  ) {
    const ticket = await this.ticketsService.findOne(user.tenantId, ticketId);
    // Dong bo lai finalPrice cua ticket cho khop voi hoa don vua tao thu cong,
    // tranh tinh trang xem lai ticket thay gia khac voi hoa don da xuat.
    await this.ticketsService.setFinalPrice(user.tenantId, ticketId, dto.finalPrice);
    return this.invoiceService.createFromTicket(
      user.tenantId,
      ticketId,
      ticket.customerId,
      dto.finalPrice,
    );
  }

  // Hanh dong tai chinh (xac nhan da thu tien) - CHI Admin
  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN)
  markPaid(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.invoiceService.markPaid(user.tenantId, id);
  }
}
