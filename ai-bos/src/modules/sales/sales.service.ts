import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from '../warehouse/inventory-item.entity';
import { ShopService } from '../shop/shop.service';
import { TicketsService } from '../tickets/tickets.service';
import { AddOnRule, TriggerType } from './add-on-rule.entity';
import { CreateAddOnRuleDto } from './dto/sales.dto';

export interface AddOnSuggestion {
  product?: { sku: string; name: string; sellPrice: number };
  serviceNote?: string;
  reason: string; // vd: "Vi don hang co SSD-SAMSUNG-1TB"
}

/**
 * AI Sales - rule-based (khong goi Claude API), dung mapping don gian de goi y
 * san pham/dich vu cong them, giong dung vi du ban dau: "khach mua SSD -> AI
 * goi y cai Windows, Office, Antivirus, sao luu du lieu, ve sinh may".
 */
@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(AddOnRule) private readonly ruleRepo: Repository<AddOnRule>,
    @InjectRepository(InventoryItem) private readonly itemRepo: Repository<InventoryItem>,
    private readonly shopService: ShopService,
    private readonly ticketsService: TicketsService,
  ) {}

  async createRule(tenantId: string, dto: CreateAddOnRuleDto): Promise<AddOnRule> {
    const rule = this.ruleRepo.create({ tenantId, ...dto });
    return this.ruleRepo.save(rule);
  }

  async findAllRules(tenantId: string): Promise<AddOnRule[]> {
    return this.ruleRepo.find({ where: { tenantId, isActive: true } });
  }

  /** Goi y add-on khi khach dat don hang (Shop) - dua theo SKU san pham trong don */
  async suggestForOrder(tenantId: string, orderId: string): Promise<AddOnSuggestion[]> {
    const orderItems = await this.shopService.getOrderItems(tenantId, orderId);
    const existingSkus = new Set<string>();

    const skus: string[] = [];
    for (const line of orderItems) {
      const item = await this.itemRepo.findOne({
        where: { tenantId, id: line.inventoryItemId },
      });
      if (item) {
        skus.push(item.sku);
        existingSkus.add(item.sku);
      }
    }

    if (skus.length === 0) return [];

    const rules = await this.ruleRepo.find({
      where: { tenantId, triggerType: TriggerType.PRODUCT_SKU, isActive: true },
    });

    const matchedRules = rules.filter((r) => skus.includes(r.triggerValue));
    return this.buildSuggestions(tenantId, matchedRules, existingSkus);
  }

  /** Goi y add-on khi tao/xu ly ticket sua chua - dua theo ky nang can trong ticket */
  async suggestForTicket(tenantId: string, ticketId: string): Promise<AddOnSuggestion[]> {
    const ticket = await this.ticketsService.findOne(tenantId, ticketId);
    const skills = ticket.skillRequired || [];

    if (skills.length === 0) return [];

    const rules = await this.ruleRepo.find({
      where: { tenantId, triggerType: TriggerType.SKILL_CODE, isActive: true },
    });

    const matchedRules = rules.filter((r) => skills.includes(r.triggerValue));
    return this.buildSuggestions(tenantId, matchedRules, new Set());
  }

  private async buildSuggestions(
    tenantId: string,
    rules: AddOnRule[],
    excludeSkus: Set<string>,
  ): Promise<AddOnSuggestion[]> {
    const suggestions: AddOnSuggestion[] = [];

    for (const rule of rules) {
      for (const sku of rule.suggestedProductSkus || []) {
        if (excludeSkus.has(sku)) continue; // khong goi y lai san pham khach da mua/co san trong don

        const product = await this.itemRepo.findOne({ where: { tenantId, sku } });
        if (product) {
          suggestions.push({
            product: { sku: product.sku, name: product.name, sellPrice: Number(product.sellPrice) },
            reason: `Thuong duoc mua/dung kem voi "${rule.triggerValue}"`,
          });
        }
      }

      if (rule.suggestedServiceNote) {
        suggestions.push({
          serviceNote: rule.suggestedServiceNote,
          reason: `Dich vu cong them lien quan den "${rule.triggerValue}"`,
        });
      }
    }

    return suggestions;
  }
}
