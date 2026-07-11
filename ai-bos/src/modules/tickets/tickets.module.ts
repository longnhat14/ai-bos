import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '../../common/event-bus/event-bus.module';
import { AttachmentsService } from './attachments.service';
import { TicketAttachment } from './ticket-attachment.entity';
import { TicketStatusHistory } from './ticket-status-history.entity';
import { Ticket } from './ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketStatusHistory, TicketAttachment]),
    EventBusModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, AttachmentsService],
  exports: [TicketsService, AttachmentsService],
})
export class TicketsModule {}
