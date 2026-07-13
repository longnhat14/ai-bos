import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '../../common/event-bus/event-bus.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TicketPart } from '../warehouse/ticket-part.entity';
import { Invoice } from './invoice.entity';
import { InvoiceController } from './invoice.controller';
import { InvoiceEventHandler } from './invoice-event.handler';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, TicketPart]), EventBusModule, TicketsModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceEventHandler],
  exports: [InvoiceService, InvoiceEventHandler],
})
export class InvoiceModule {}
