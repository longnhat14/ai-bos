import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '../../common/event-bus/event-bus.module';
import { Warranty } from './warranty.entity';
import { WarrantyController } from './warranty.controller';
import { WarrantyEventHandler } from './warranty-event.handler';
import { WarrantyService } from './warranty.service';

@Module({
  imports: [TypeOrmModule.forFeature([Warranty]), EventBusModule],
  controllers: [WarrantyController],
  providers: [WarrantyService, WarrantyEventHandler],
  exports: [WarrantyService, WarrantyEventHandler],
})
export class WarrantyModule {}
