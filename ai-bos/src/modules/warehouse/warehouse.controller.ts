import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { AdjustStockDto, CreateInventoryItemDto, UsePartForTicketDto } from './dto/warehouse.dto';
import { WarehouseService } from './warehouse.service';

@Controller('api/v1/warehouse')
@UseGuards(JwtAuthGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post('items')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateInventoryItemDto) {
    return this.warehouseService.create(user.tenantId, dto);
  }

  @Get('items')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.warehouseService.findAll(user.tenantId);
  }

  @Get('items/low-stock')
  findLowStock(@CurrentUser() user: JwtPayload) {
    return this.warehouseService.findLowStock(user.tenantId);
  }

  @Get('items/:id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.warehouseService.findOne(user.tenantId, id);
  }

  @Patch('items/:id/adjust-stock')
  adjustStock(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.warehouseService.adjustStock(user.tenantId, id, dto);
  }

  // Dung linh kien cho 1 ticket cu the - tru kho ngay lap tuc
  @Post('tickets/:ticketId/parts')
  usePartForTicket(
    @CurrentUser() user: JwtPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: UsePartForTicketDto,
  ) {
    return this.warehouseService.usePartForTicket(user.tenantId, ticketId, dto);
  }

  @Get('tickets/:ticketId/parts')
  getPartsByTicket(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.warehouseService.getPartsByTicket(user.tenantId, ticketId);
  }
}
