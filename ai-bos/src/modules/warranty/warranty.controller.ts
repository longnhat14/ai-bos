import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ManualCreateWarrantyDto, VoidWarrantyDto } from './dto/warranty.dto';
import { WarrantyService } from './warranty.service';

@Controller('api/v1/warranty')
@UseGuards(JwtAuthGuard)
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  // Tao thu cong - dung khi can tao bao hanh khong qua luong dong ticket binh thuong
  @Post()
  createManual(@CurrentUser() user: JwtPayload, @Body() dto: ManualCreateWarrantyDto) {
    return this.warrantyService.createManual(user.tenantId, dto);
  }

  @Get('by-ticket/:ticketId')
  findByTicket(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.warrantyService.findByTicket(user.tenantId, ticketId);
  }

  @Get('by-customer/:customerId')
  findByCustomer(@CurrentUser() user: JwtPayload, @Param('customerId') customerId: string) {
    return this.warrantyService.findByCustomer(user.tenantId, customerId);
  }

  // Endpoint quan trong nhat: KTV/nhan vien dung de kiem tra nhanh "khach nay con bao hanh khong?"
  @Get('check/:ticketId')
  checkActive(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.warrantyService.checkActive(user.tenantId, ticketId);
  }

  @Patch(':id/void')
  voidWarranty(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: VoidWarrantyDto,
  ) {
    return this.warrantyService.voidWarranty(user.tenantId, id, dto);
  }
}
