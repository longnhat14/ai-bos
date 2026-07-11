import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';
import { DispatcherController } from './dispatcher.controller';
import { DispatcherService } from './dispatcher.service';

@Module({
  imports: [UsersModule, TicketsModule, CustomersModule],
  controllers: [DispatcherController],
  providers: [DispatcherService],
  exports: [DispatcherService],
})
export class DispatcherModule {}
