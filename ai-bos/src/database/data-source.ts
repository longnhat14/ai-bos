import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Tenant } from '../modules/tenants/tenant.entity';
import { User } from '../modules/users/user.entity';
import { Customer } from '../modules/customers/customer.entity';
import { Ticket } from '../modules/tickets/ticket.entity';
import { TicketStatusHistory } from '../modules/tickets/ticket-status-history.entity';
import { EventLog } from '../common/event-bus/event-log.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'ai_bos',
  password: process.env.DB_PASSWORD || 'ai_bos_password',
  database: process.env.DB_NAME || 'ai_bos',
  entities: [Tenant, User, Customer, Ticket, TicketStatusHistory, EventLog],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false, // KHONG dung true o production - dung migration
  logging: process.env.NODE_ENV === 'development',
});
