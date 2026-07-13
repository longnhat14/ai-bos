import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { ManualCreateWarrantyDto, VoidWarrantyDto } from './dto/warranty.dto';
import { WarrantyService } from './warranty.service';

@Controller('api/v1/warranty')
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.warrantyService.findAll(user.tenantId);
  }

  // Dat SAU cac route tinh (by-ticket, by-customer, check) de tranh ':id' "nuot"
  // nham cac path do - NestJS/Express khop theo THU TU dang ky, route cang cu
  // the (khong co tham so) can dang ky truoc route co tham so o cung vi tri.
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.warrantyService.findOne(user.tenantId, id);
  }

  // Chi Admin duoc HUY bao hanh - day la hanh dong co hau qua ve tai chinh/phap ly
  // voi khach hang, KHONG the de Technician tu y thuc hien.
  @Patch(':id/void')
  @Roles(UserRole.ADMIN)
  voidWarranty(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: VoidWarrantyDto,
  ) {
    return this.warrantyService.voidWarranty(user.tenantId, id, dto);
  }
}
