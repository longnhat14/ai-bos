import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { EventType } from '../../common/event-bus/events';
import { AdjustStockDto, CreateInventoryItemDto, UsePartForTicketDto } from './dto/warehouse.dto';
import { InventoryItem } from './inventory-item.entity';
import { TicketPart } from './ticket-part.entity';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(InventoryItem) private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(TicketPart) private readonly ticketPartRepo: Repository<TicketPart>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async create(tenantId: string, dto: CreateInventoryItemDto): Promise<InventoryItem> {
    const item = this.itemRepo.create({ tenantId, ...dto });
    await this.itemRepo.save(item);

    await this.eventBus.publish(tenantId, EventType.INVENTORY_ITEM_CREATED, {
      itemId: item.id,
      sku: item.sku,
    });

    return item;
  }

  async findAll(tenantId: string): Promise<InventoryItem[]> {
    return this.itemRepo.find({ where: { tenantId, isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { tenantId, id } });
    if (!item) throw new NotFoundException('Khong tim thay linh kien trong kho');
    return item;
  }

  async findLowStock(tenantId: string): Promise<InventoryItem[]> {
    const items = await this.findAll(tenantId);
    return items.filter((item) => item.quantityOnHand <= item.lowStockThreshold);
  }

  /**
   * Nhap/xuat kho thu cong (khong gan voi ticket cu the), vd nhap hang moi ve.
   */
  async adjustStock(tenantId: string, id: string, dto: AdjustStockDto): Promise<InventoryItem> {
    const item = await this.findOne(tenantId, id);
    const newQuantity = item.quantityOnHand + dto.quantityChange;

    if (newQuantity < 0) {
      throw new BadRequestException(
        `Khong the xuat kho: ton kho hien tai (${item.quantityOnHand}) khong du`,
      );
    }

    item.quantityOnHand = newQuantity;
    await this.itemRepo.save(item);

    await this.eventBus.publish(tenantId, EventType.INVENTORY_STOCK_ADJUSTED, {
      itemId: item.id,
      sku: item.sku,
      quantityChange: dto.quantityChange,
      newQuantity,
      note: dto.note,
    });

    if (newQuantity <= item.lowStockThreshold) {
      await this.eventBus.publish(tenantId, EventType.INVENTORY_LOW_STOCK, {
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        quantityOnHand: newQuantity,
        threshold: item.lowStockThreshold,
      });
    }

    return item;
  }

  /**
   * Dung linh kien cho 1 ticket cu the - tru kho VA ghi lai TicketPart trong CUNG 1 transaction,
   * tranh tinh trang tru kho thanh cong nhung ghi TicketPart that bai (hoac nguoc lai).
   */
  async usePartForTicket(
    tenantId: string,
    ticketId: string,
    dto: UsePartForTicketDto,
  ): Promise<TicketPart> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(InventoryItem, {
        where: { tenantId, id: dto.inventoryItemId },
        lock: { mode: 'pessimistic_write' }, // khoa dong de tranh 2 request tru kho cung luc gay am kho
      });

      if (!item) throw new NotFoundException('Khong tim thay linh kien trong kho');

      if (item.quantityOnHand < dto.quantity) {
        throw new BadRequestException(
          `Khong du hang: "${item.name}" chi con ${item.quantityOnHand}, can ${dto.quantity}`,
        );
      }

      item.quantityOnHand -= dto.quantity;
      await manager.save(item);

      const ticketPart = manager.create(TicketPart, {
        tenantId,
        ticketId,
        inventoryItemId: item.id,
        quantity: dto.quantity,
        unitCostPrice: item.costPrice,
        unitSellPrice: item.sellPrice,
      });
      await manager.save(ticketPart);

      // Publish event sau khi transaction DB thanh cong (khong lam trong transaction
      // vi EventBusService tu ghi outbox rieng, khong can chung transaction voi tru kho)
      await this.eventBus.publish(tenantId, EventType.TICKET_PART_USED, {
        ticketId,
        itemId: item.id,
        sku: item.sku,
        quantity: dto.quantity,
        unitSellPrice: item.sellPrice,
      });

      if (item.quantityOnHand <= item.lowStockThreshold) {
        await this.eventBus.publish(tenantId, EventType.INVENTORY_LOW_STOCK, {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          quantityOnHand: item.quantityOnHand,
          threshold: item.lowStockThreshold,
        });
      }

      return ticketPart;
    });
  }

  async getPartsByTicket(tenantId: string, ticketId: string): Promise<TicketPart[]> {
    return this.ticketPartRepo.find({ where: { tenantId, ticketId } });
  }
}
