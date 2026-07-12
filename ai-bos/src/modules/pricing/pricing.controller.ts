import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { CreatePriceCatalogDto, UpdatePriceCatalogDto } from './dto/pricing.dto';
import { PricingService } from './pricing.service';

@Controller('api/v1/pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // Quan ly bang gia cong sua - CHI Admin duoc cau hinh gia, tranh KTV tu y doi gia
  @Post('catalog')
  @Roles(UserRole.ADMIN)
  createCatalogEntry(@CurrentUser() user: JwtPayload, @Body() dto: CreatePriceCatalogDto) {
    return this.pricingService.createCatalogEntry(user.tenantId, dto);
  }

  @Get('catalog')
  findAllCatalog(@CurrentUser() user: JwtPayload) {
    return this.pricingService.findAllCatalog(user.tenantId);
  }

  @Patch('catalog/:id')
  @Roles(UserRole.ADMIN)
  updateCatalogEntry(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePriceCatalogDto,
  ) {
    return this.pricingService.updateCatalogEntry(user.tenantId, id, dto);
  }

  // Endpoint chinh: AI de xuat bao gia cho 1 ticket cu the - KTV van duoc xem de bao gia cho khach
  @Get('suggest/:ticketId')
  suggestQuote(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.pricingService.suggestQuote(user.tenantId, ticketId);
  }
}
