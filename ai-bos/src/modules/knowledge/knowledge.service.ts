import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateKnowledgeEntryDto, UpdateKnowledgeEntryDto } from './dto/knowledge.dto';
import { KnowledgeEntry } from './knowledge-entry.entity';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeEntry) private readonly knowledgeRepo: Repository<KnowledgeEntry>,
  ) {}

  async create(tenantId: string, dto: CreateKnowledgeEntryDto): Promise<KnowledgeEntry> {
    const entry = this.knowledgeRepo.create({ tenantId, ...dto });
    return this.knowledgeRepo.save(entry);
  }

  async findAll(tenantId: string): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepo.find({ where: { tenantId, isActive: true }, order: { title: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepo.findOne({ where: { tenantId, id } });
    if (!entry) throw new NotFoundException('Khong tim thay muc kien thuc');
    return entry;
  }

  async update(tenantId: string, id: string, dto: UpdateKnowledgeEntryDto): Promise<KnowledgeEntry> {
    const entry = await this.findOne(tenantId, id);
    Object.assign(entry, dto);
    return this.knowledgeRepo.save(entry);
  }

  /**
   * Tim kiem theo tu khoa (KHONG PHAI vector search that su - xem ghi chu trong entity).
   * Cham diem lien quan don gian bang cach dem so tu trong query xuat hien trong
   * title/content/tags, roi sap xep giam dan. Phu hop quy mo du lieu 1 tiem sua chua
   * (vai tram muc), khong toi uu cho hang chuc nghin muc (luc do can vector search that).
   */
  async search(tenantId: string, query: string, limit = 3): Promise<KnowledgeEntry[]> {
    const allEntries = await this.findAll(tenantId);
    if (allEntries.length === 0) return [];

    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return [];

    const scored = allEntries.map((entry) => {
      const searchableText = [
        entry.title,
        entry.content,
        ...(entry.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      const score = queryWords.reduce(
        (sum, word) => sum + (searchableText.includes(word) ? 1 : 0),
        0,
      );

      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,.!?;:]+/)
      .filter((word) => word.length >= 2); // bo qua tu qua ngan (a, o, ...) it y nghia khi tim
  }
}
