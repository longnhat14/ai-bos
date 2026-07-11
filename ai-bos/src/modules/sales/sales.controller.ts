import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateAddOnRuleDto } from './dto/sales.dto';
import { SalesService } from './sales.service';

@Controller('api/v1/sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('rules')
  createRule(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddOnRuleDto) {
    return this.salesService.createRule(user.tenantId, dto);
  }

  @Get('rules')
  findAllRules(@CurrentUser() user: JwtPayload) {
    return this.salesService.findAllRules(user.tenantId);
  }

  @Get('suggest/order/:orderId')
  suggestForOrder(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.salesService.suggestForOrder(user.tenantId, orderId);
  }

  @Get('suggest/ticket/:ticketId')
  suggestForTicket(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.salesService.suggestForTicket(user.tenantId, ticketId);
  }
}
