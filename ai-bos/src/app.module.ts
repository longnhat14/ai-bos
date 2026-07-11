import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from './modules/tenants/tenant.entity';
import { User } from './modules/users/user.entity';
import { Customer } from './modules/customers/customer.entity';
import { Ticket } from './modules/tickets/ticket.entity';
import { TicketStatusHistory } from './modules/tickets/ticket-status-history.entity';
import { EventLog } from './common/event-bus/event-log.entity';

import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { EventBusModule } from './common/event-bus/event-bus.module';
import { NotificationProcessor } from './common/event-bus/notification.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mariadb',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get('DB_USER', 'ai_bos'),
        password: config.get('DB_PASSWORD', 'ai_bos_password'),
        database: config.get('DB_NAME', 'ai_bos'),
        entities: [Tenant, User, Customer, Ticket, TicketStatusHistory, EventLog],
        synchronize: config.get('NODE_ENV') === 'development', // CHI true khi dev, production dung migration
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    TenantsModule,
    AuthModule,
    CustomersModule,
    TicketsModule,
    EventBusModule,
  ],
  providers: [NotificationProcessor],
})
export class AppModule {}
