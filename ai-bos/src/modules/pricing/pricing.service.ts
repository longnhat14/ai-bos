import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketsService } from '../tickets/tickets.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { CreatePriceCatalogDto, UpdatePriceCatalogDto } from './dto/pricing.dto';
import { PriceCatalog } from './price-catalog.entity';

export interface QuoteSuggestion {
  laborBreakdown: { skillCode: string; description: string; laborPrice: number }[];
  laborTotal: number;
  partsAmount: number;
  suggestedTotal: number;
  missingSkills: string[]; // ky nang trong ticket nhung chua co gia trong bang gia
}

/**
 * Chuan hoa ten dich vu de so sanh: bo khoang trang thua dau/cuoi, gom nhieu
 * khoang trang lien tiep thanh 1, chuyen ve chu thuong. Nho vay "Mainboard",
 * "mainboard", " main board " deu duoc coi la CUNG 1 dich vu khi so khop -
 * nguoi dung khong can go chinh xac tung ky tu hoa/thuong/khoang trang.
 */
function normalizeSkillCode(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * AI Pricing - Sprint 10.
 *
 * Nguyen tac quan trong da thong nhat tu dau: AI KHONG duoc tu bia gia -
 * moi con so deu lay tu du lieu that (bang gia dich vu da cau hinh + gia linh
 * kien THAT tu Kho, khong phai AI tu doan). Day chi la GOI Y, nhan vien van
 * phai xac nhan qua endpoint PATCH /tickets/:id/quote da co san (Sprint 1),
 * dung nguyen tac "AI de xuat, con nguoi xac nhan" giong AI Dispatcher.
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PriceCatalog) private readonly catalogRepo: Repository<PriceCatalog>,
    private readonly ticketsService: TicketsService,
    private readonly warehouseService: WarehouseService,
  ) {}

  async createCatalogEntry(tenantId: string, dto: CreatePriceCatalogDto): Promise<PriceCatalog> {
    const normalized = normalizeSkillCode(dto.skillCode);

    // Tranh tao trung: neu da co dich vu voi ten CHUAN HOA giong het (du go
    // hoa/thuong/khoang trang khac nhau), bao loi thay vi tao ban ghi trung lap.
    const existingAll = await this.catalogRepo.find({ where: { tenantId, isActive: true } });
    const duplicate = existingAll.find((e) => normalizeSkillCode(e.skillCode) === normalized);
    if (duplicate) {
      throw new ConflictException(
        `Dich vu "${duplicate.skillCode}" da ton tai voi gia ${duplicate.laborPrice}d - hay sua muc gia do thay vi tao moi.`,
      );
    }

    const entry = this.catalogRepo.create({ tenantId, ...dto, skillCode: normalized });
    return this.catalogRepo.save(entry);
  }

  async findAllCatalog(tenantId: string): Promise<PriceCatalog[]> {
    return this.catalogRepo.find({ where: { tenantId, isActive: true }, order: { skillCode: 'ASC' } });
  }

  async updateCatalogEntry(
    tenantId: string,
    id: string,
    dto: UpdatePriceCatalogDto,
  ): Promise<PriceCatalog> {
    const entry = await this.catalogRepo.findOne({ where: { tenantId, id } });
    if (!entry) throw new NotFoundException('Khong tim thay muc gia trong bang gia');

    if (dto.description !== undefined) entry.description = dto.description;
    if (dto.laborPrice !== undefined) entry.laborPrice = dto.laborPrice;
    if (dto.warrantyMonths !== undefined) entry.warrantyMonths = dto.warrantyMonths;

    return this.catalogRepo.save(entry);
  }

  /**
   * Tinh bao gia goi y cho 1 ticket:
   * - Tien cong = tong gia cong theo tung dich vu trong ticket.skillRequired (tra bang gia,
   *   SO KHOP KHONG PHAN BIET hoa/thuong/khoang trang - xem normalizeSkillCode)
   * - Tien linh kien = tong gia ban cua cac linh kien DA DUOC DUNG cho ticket
   *   (tu bang ticket_parts, xem Warehouse module - neu chua dung linh kien nao thi = 0)
   */
  async suggestQuote(tenantId: string, ticketId: string): Promise<QuoteSuggestion> {
    const ticket = await this.ticketsService.findOne(tenantId, ticketId);
    const skillsRequired = ticket.skillRequired || [];

    // Lay het bang gia 1 lan, so khop CHUAN HOA trong bo nho - tranh N query rieng
    // le VA cho phep so khop khong phan biet hoa/thuong/khoang trang (DB LIKE khong
    // dam bao nhat quan giua cac collation khac nhau).
    const allEntries = await this.catalogRepo.find({ where: { tenantId, isActive: true } });
    const entryByNormalizedCode = new Map(
      allEntries.map((e) => [normalizeSkillCode(e.skillCode), e]),
    );

    const laborBreakdown: QuoteSuggestion['laborBreakdown'] = [];
    const missingSkills: string[] = [];

    for (const skillCode of skillsRequired) {
      const entry = entryByNormalizedCode.get(normalizeSkillCode(skillCode));
      if (entry) {
        laborBreakdown.push({
          skillCode: entry.skillCode,
          description: entry.description,
          laborPrice: Number(entry.laborPrice),
        });
      } else {
        missingSkills.push(skillCode);
      }
    }

    const laborTotal = laborBreakdown.reduce((sum, item) => sum + item.laborPrice, 0);

    const usedParts = await this.warehouseService.getPartsByTicket(tenantId, ticketId);
    const partsAmount = usedParts.reduce(
      (sum, part) => sum + Number(part.unitSellPrice) * part.quantity,
      0,
    );

    return {
      laborBreakdown,
      laborTotal,
      partsAmount,
      suggestedTotal: laborTotal + partsAmount,
      missingSkills,
    };
  }
}
