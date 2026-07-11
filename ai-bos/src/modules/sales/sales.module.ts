import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../warehouse/inventory-item.entity';
import { ShopModule } from '../shop/shop.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AddOnRule } from './add-on-rule.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [TypeOrmModule.forFeature([AddOnRule, InventoryItem]), ShopModule, TicketsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
