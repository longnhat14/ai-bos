import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreatePriceCatalogDto, UpdatePriceCatalogDto } from './dto/pricing.dto';
import { PricingService } from './pricing.service';

@Controller('api/v1/pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // Quan ly bang gia cong sua (Admin cau hinh)
  @Post('catalog')
  createCatalogEntry(@CurrentUser() user: JwtPayload, @Body() dto: CreatePriceCatalogDto) {
    return this.pricingService.createCatalogEntry(user.tenantId, dto);
  }

  @Get('catalog')
  findAllCatalog(@CurrentUser() user: JwtPayload) {
    return this.pricingService.findAllCatalog(user.tenantId);
  }

  @Patch('catalog/:id')
  updateCatalogEntry(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePriceCatalogDto,
  ) {
    return this.pricingService.updateCatalogEntry(user.tenantId, id, dto);
  }

  // Endpoint chinh: AI de xuat bao gia cho 1 ticket cu the
  @Get('suggest/:ticketId')
  suggestQuote(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.pricingService.suggestQuote(user.tenantId, ticketId);
  }
}
