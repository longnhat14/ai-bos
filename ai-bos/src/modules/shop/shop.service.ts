import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import { InventoryItem } from '../warehouse/inventory-item.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/shop.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Tao don hang MOI VA tru kho NGAY LAP TUC trong cung 1 transaction
   * (khac voi Ticket - Shop la ban hang truc tiep nen giu cho ngay khi dat,
   * tranh 2 khach cung mua het hang ma ca 2 don deu "thanh cong").
   * Neu don bi huy sau do, se hoan kho lai (xem cancelOrder).
   */
  async createOrder(tenantId: string, dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      let totalAmount = 0;
      const orderItemsData: { inventoryItemId: string; quantity: number; unitPrice: number }[] = [];

      for (const line of dto.items) {
        const item = await manager.findOne(InventoryItem, {
          where: { tenantId, id: line.inventoryItemId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!item) {
          throw new NotFoundException(`Khong tim thay san pham: ${line.inventoryItemId}`);
        }
        if (item.quantityOnHand < line.quantity) {
          throw new BadRequestException(
            `Khong du hang: "${item.name}" chi con ${item.quantityOnHand}, can ${line.quantity}`,
          );
        }

        item.quantityOnHand -= line.quantity;
        await manager.save(item);

        orderItemsData.push({
          inventoryItemId: item.id,
          quantity: line.quantity,
          unitPrice: item.sellPrice,
        });
        totalAmount += Number(item.sellPrice) * line.quantity;
      }

      const orderNumber = await this.generateOrderNumber(tenantId, manager);

      const order = manager.create(Order, {
        tenantId,
        orderNumber,
        customerId: dto.customerId,
        status: OrderStatus.PENDING,
        totalAmount,
        notes: dto.notes,
      });
      await manager.save(order);

      for (const line of orderItemsData) {
        const orderItem = manager.create(OrderItem, {
          tenantId,
          orderId: order.id,
          ...line,
        });
        await manager.save(orderItem);
      }

      await this.eventBus.publish(tenantId, EventType.ORDER_CREATED, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        totalAmount: order.totalAmount,
      });

      return order;
    });
  }

  async findAll(tenantId: string): Promise<Order[]> {
    return this.orderRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { tenantId, id } });
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    return order;
  }

  async getOrderItems(tenantId: string, orderId: string): Promise<OrderItem[]> {
    return this.orderItemRepo.find({ where: { tenantId, orderId } });
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findOne(tenantId, id);

    if (dto.status === OrderStatus.CANCELLED) {
      return this.cancelOrder(tenantId, order);
    }

    order.status = dto.status;
    await this.orderRepo.save(order);

    const eventMap: Partial<Record<OrderStatus, EventType>> = {
      [OrderStatus.CONFIRMED]: EventType.ORDER_CONFIRMED,
      [OrderStatus.COMPLETED]: EventType.ORDER_COMPLETED,
    };
    const eventType = eventMap[dto.status];
    if (eventType) {
      await this.eventBus.publish(tenantId, eventType, {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }

    return order;
  }

  /**
   * Huy don hang - HOAN LAI kho vi da tru khi tao don (xem createOrder).
   */
  private async cancelOrder(tenantId: string, order: Order): Promise<Order> {
    if (order.status === OrderStatus.CANCELLED) return order;

    return this.dataSource.transaction(async (manager) => {
      const items = await manager.find(OrderItem, { where: { tenantId, orderId: order.id } });

      for (const line of items) {
        const item = await manager.findOne(InventoryItem, {
          where: { tenantId, id: line.inventoryItemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (item) {
          item.quantityOnHand += line.quantity;
          await manager.save(item);
        }
      }

      order.status = OrderStatus.CANCELLED;
      await manager.save(order);

      await this.eventBus.publish(tenantId, EventType.ORDER_CANCELLED, {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });

      return order;
    });
  }

  private async generateOrderNumber(tenantId: string, manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const count = await manager.count(Order, { where: { tenantId } });
    const nextNumber = (count + 1).toString().padStart(4, '0');
    return `ORD-${year}-${nextNumber}`;
  }
}
