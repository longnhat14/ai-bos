import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/shop.dto';
import { ShopService } from './shop.service';

@Controller('api/v1/shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Post('orders')
  createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.shopService.createOrder(user.tenantId, dto);
  }

  @Get('orders')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.shopService.findAll(user.tenantId);
  }

  @Get('orders/:id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.shopService.findOne(user.tenantId, id);
  }

  @Get('orders/:id/items')
  getOrderItems(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.shopService.getOrderItems(user.tenantId, id);
  }

  @Patch('orders/:id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.shopService.updateStatus(user.tenantId, id, dto);
  }
}
