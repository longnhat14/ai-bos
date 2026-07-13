import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '../../common/event-bus/event-bus.module';
import { InventoryItem } from './inventory-item.entity';
import { InventoryItemImage } from './inventory-item-image.entity';
import { TicketPart } from './ticket-part.entity';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, TicketPart, InventoryItemImage]), EventBusModule],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
