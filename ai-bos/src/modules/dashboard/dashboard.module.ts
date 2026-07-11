import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoice/invoice.entity';
import { InventoryItem } from '../warehouse/inventory-item.entity';
import { Order } from '../shop/order.entity';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Invoice, InventoryItem, Order, User])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
