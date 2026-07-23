import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Customer, Ticket, User])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
