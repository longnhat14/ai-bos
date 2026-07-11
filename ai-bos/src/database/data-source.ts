import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Tenant } from '../modules/tenants/tenant.entity';
import { User } from '../modules/users/user.entity';
import { Customer } from '../modules/customers/customer.entity';
import { Ticket } from '../modules/tickets/ticket.entity';
import { TicketStatusHistory } from '../modules/tickets/ticket-status-history.entity';
import { InventoryItem } from '../modules/warehouse/inventory-item.entity';
import { TicketPart } from '../modules/warehouse/ticket-part.entity';
import { Invoice } from '../modules/invoice/invoice.entity';
import { Warranty } from '../modules/warranty/warranty.entity';
import { Order } from '../modules/shop/order.entity';
import { OrderItem } from '../modules/shop/order-item.entity';
import { EventLog } from '../common/event-bus/event-log.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'ai_bos',
  password: process.env.DB_PASSWORD || 'ai_bos_password',
  database: process.env.DB_NAME || 'ai_bos',
  entities: [
    Tenant,
    User,
    Customer,
    Ticket,
    TicketStatusHistory,
    InventoryItem,
    TicketPart,
    Invoice,
    Warranty,
    Order,
    OrderItem,
    EventLog,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false, // KHONG dung true o production - dung migration
  logging: process.env.NODE_ENV === 'development',
});
