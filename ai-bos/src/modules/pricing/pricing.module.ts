import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsModule } from '../tickets/tickets.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { PriceCatalog } from './price-catalog.entity';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([PriceCatalog]), TicketsModule, WarehouseModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
