import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AttachmentsService } from '../tickets/attachments.service';
import { TicketAttachment } from '../tickets/ticket-attachment.entity';
import { TicketsService } from '../tickets/tickets.service';
import { DiagnosticCache } from './diagnostic-cache.entity';
import { ConfirmDiagnosisDto } from './dto/diagnostic.dto';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DIAGNOSTIC_MODEL = 'claude-haiku-4-5-20251001'; // ho tro vision, nhanh, re, du cho bai toan phan loai xac suat loi

export interface ProbableCause {
  cause: string;
  probability: number; // 0-100
  suggestedAction: string;
}

export interface DiagnosticResult {
  ticketId: string;
  probableCauses: ProbableCause[];
  recommendedPartsToPrepare: string[];
  matchedKnowledgeEntries: string[]; // ten cac SOP da duoc dung lam ngu canh (RAG)
  imagesAnalyzed: number; // so anh da duoc AI doc de chan doan
  fromCache: boolean; // true neu lay tu cache, khong goi Claude API lan nay
  note: string;
}

/**
 * AI Diagnostic - Sprint 11.
 *
 * QUAN TRONG - dung nguyen tac da thong nhat: day CHI la GOI Y xac suat de
 * ky thuat vien chuan bi linh kien truoc, KHONG PHAI ket luan cuoi cung.
 *
 * DA TICH HOP:
 * 1. AI Knowledge (RAG): tim SOP lien quan truoc khi hoi AI.
 * 2. Cache CHINH XAC (exact-match): cau hoi + thiet bi + anh dinh kem GIONG HET
 *    se tra lai ket qua cu, khong goi lai Claude API.
 * 3. Xac nhan cua ky thuat vien: nuoi Knowledge Base tu ket qua da kiem chung.
 * 4. DOC ANH (Claude Vision): neu khach hang upload anh loi/man hinh loi/hu hong
 *    vat ly, AI se "nhin" truc tiep anh do (khong can OCR rieng) de chan doan
 *    chinh xac hon, dac biet huu ich voi loi hien thi tren man hinh (blue screen,
 *    ma loi hien thi...) hoac hu hong vat ly quan sat duoc bang mat.
 */
@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger(DiagnosticService.name);

  constructor(
    @InjectRepository(DiagnosticCache) private readonly cacheRepo: Repository<DiagnosticCache>,
    private readonly ticketsService: TicketsService,
    private readonly knowledgeService: KnowledgeService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async diagnose(tenantId: string, ticketId: string): Promise<DiagnosticResult> {
    const ticket = await this.ticketsService.findOne(tenantId, ticketId);
    const images = await this.attachmentsService.findImagesByTicket(tenantId, ticketId);

    const queryHash = await this.computeHash(ticket.deviceType, ticket.issueDescription, images);

    // BUOC 1: kiem tra cache chinh xac truoc - neu co, tra ve ngay, KHONG goi API
    const cached = await this.cacheRepo.findOne({ where: { tenantId, queryHash } });
    if (cached) {
      cached.hitCount += 1;
      await this.cacheRepo.save(cached);
      this.logger.log(`Cache hit cho ticket ${ticketId} (da dung lai lan thu ${cached.hitCount})`);
      return { ...(cached.resultJson as any), ticketId, fromCache: true };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY chua cau hinh - khong the chan doan');
      return {
        ticketId,
        probableCauses: [],
        recommendedPartsToPrepare: [],
        matchedKnowledgeEntries: [],
        imagesAnalyzed: 0,
        fromCache: false,
        note: 'Chua cau hinh ANTHROPIC_API_KEY, khong the goi AI chan doan.',
      };
    }

    const systemPrompt = `You are an AI Diagnostic Engine for a computer/IT repair business (PCTech/RemoteIT).
Given a customer's reported symptom (in Vietnamese or English), and optionally photos of the device/error screen/damage, estimate the probable hardware/software causes.

Respond with ONLY valid JSON (no markdown, no explanation) matching exactly this schema:
{
  "probableCauses": [
    { "cause": "string (ten nguyen nhan, tieng Viet)", "probability": number (0-100), "suggestedAction": "string (viec ky thuat vien nen chuan bi/kiem tra, tieng Viet)" }
  ],
  "recommendedPartsToPrepare": ["string (ten linh kien nen mang theo, tieng Viet)"]
}

Rules:
- Probabilities across all probableCauses should sum to approximately 100.
- List at most 5 causes, ordered from most to least likely.
- Be specific to common PC/laptop repair scenarios (RAM, PSU, mainboard, storage, overheating, drivers, network...).
- If images are provided, examine them carefully: look for error codes/messages on screen, physical damage (burn marks, liquid damage, bent pins, swollen capacitors), cable/port condition, etc. State clearly if the images changed your assessment.
- If relevant SOP/knowledge base entries are provided below, PRIORITIZE them over general knowledge -
  they reflect this specific business's real repair history and procedures.
- This is a SUGGESTION for the technician to prepare parts in advance, not a final diagnosis.`;

    // RAG: tim SOP lien quan trong Knowledge Base cua chinh tenant nay truoc khi hoi AI
    const relevantEntries = await this.knowledgeService.search(tenantId, ticket.issueDescription, 3);
    const knowledgeContext =
      relevantEntries.length > 0
        ? `\n\nRelevant SOP/knowledge base entries from this business:\n${relevantEntries
            .map((e) => `- [${e.title}] ${e.content}`)
            .join('\n')}`
        : '\n\n(Khong tim thay SOP lien quan trong Knowledge Base - dung kien thuc chung)';

    const textPrompt = `Device: ${ticket.deviceType || 'khong ro'} ${ticket.deviceModel || ''}
Trieu chung khach hang bao: "${ticket.issueDescription}"${knowledgeContext}${
      images.length > 0 ? `\n\n(Kem theo ${images.length} anh khach hang da upload, xem ben duoi)` : ''
    }`;

    try {
      // Xay dung content gui Claude: text + anh (neu co) - dung Claude Vision,
      // KHONG can OCR rieng, Claude tu "nhin" anh de doc man hinh loi/hu hong vat ly.
      const contentBlocks: any[] = [{ type: 'text', text: textPrompt }];

      for (const image of images) {
        try {
          const base64Data = await this.attachmentsService.readAsBase64(image);
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: image.mimeType, data: base64Data },
          });
        } catch (err) {
          this.logger.warn(`Bo qua anh "${image.fileName}" vi loi doc file: ${err.message}`);
        }
      }

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: DIAGNOSTIC_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: contentBlocks }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic API tra ve loi ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text?.trim();
      if (!rawText) throw new Error('Anthropic API tra ve response rong');

      const parsed = this.parseAndValidate(rawText);

      const result: DiagnosticResult = {
        ticketId,
        probableCauses: parsed.probableCauses,
        recommendedPartsToPrepare: parsed.recommendedPartsToPrepare,
        matchedKnowledgeEntries: relevantEntries.map((e) => e.title),
        imagesAnalyzed: images.length,
        fromCache: false,
        note: 'Day la goi y tu AI, ky thuat vien can tu kiem tra thuc te khi den noi.',
      };

      // BUOC 2: luu vao cache chinh xac de lan sau hoi y het (cung anh) khong can goi API nua
      const { ticketId: _omit, fromCache: _omit2, ...cacheableResult } = result;
      await this.cacheRepo.save(
        this.cacheRepo.create({
          tenantId,
          queryHash,
          deviceType: ticket.deviceType,
          issueDescription: ticket.issueDescription,
          resultJson: cacheableResult,
          hitCount: 0,
        }),
      );

      return result;
    } catch (err) {
      this.logger.error(`Loi khi chan doan ticket ${ticketId}: ${err.message}`);
      return {
        ticketId,
        probableCauses: [],
        recommendedPartsToPrepare: [],
        matchedKnowledgeEntries: [],
        imagesAnalyzed: 0,
        fromCache: false,
        note: `Khong the chan doan tu dong luc nay (${err.message}). Vui long chan doan thu cong.`,
      };
    }
  }

  /**
   * Ky thuat vien xac nhan 1 nguyen nhan AI de xuat la DUNG THUC TE sau khi sua xong.
   * Tu dong tao 1 muc Knowledge Base moi tu ket qua nay - day la co che "hoc" chinh
   * cua he thong: khong phai AI tu hoc, ma la CON NGUOI xac nhan roi nap lai vao
   * kho tri thuc, giup RAG cua AI Diagnostic chinh xac hon cho cac ticket sau nay.
   */
  async confirmDiagnosis(
    tenantId: string,
    ticketId: string,
    dto: ConfirmDiagnosisDto,
  ): Promise<{ message: string; knowledgeEntryId: string }> {
    const ticket = await this.ticketsService.findOne(tenantId, ticketId);
    const images = await this.attachmentsService.findImagesByTicket(tenantId, ticketId);
    const queryHash = await this.computeHash(ticket.deviceType, ticket.issueDescription, images);

    const cached = await this.cacheRepo.findOne({ where: { tenantId, queryHash } });
    if (!cached) {
      throw new NotFoundException(
        'Khong tim thay ket qua chan doan da luu cho ticket nay - hay goi /diagnostic/:ticketId truoc',
      );
    }

    const causes = (cached.resultJson as any).probableCauses || [];
    const confirmedCause = causes[dto.confirmedCauseIndex];
    if (!confirmedCause) {
      throw new NotFoundException('confirmedCauseIndex khong hop le');
    }

    const entry = await this.knowledgeService.create(tenantId, {
      title: `Xac nhan thuc te: ${confirmedCause.cause} (${ticket.deviceType || 'khong ro thiet bi'})`,
      content: `Trieu chung: "${ticket.issueDescription}". Nguyen nhan da xac nhan DUNG: ${confirmedCause.cause}. Ghi chu thuc te tu ky thuat vien: ${dto.actualFindingNote}`,
      category: ticket.deviceType,
      tags: ticket.skillRequired || [],
    });

    return {
      message: 'Da luu xac nhan vao Knowledge Base, cac chan doan sau se chinh xac hon.',
      knowledgeEntryId: entry.id,
    };
  }

  /**
   * Hash bao gom ca danh sach anh dinh kem (theo id, vi cung 1 ticket co the co nhieu
   * anh duoc them dan) - dam bao cache CHI tra lai ket qua cu khi text + thiet bi +
   * dung bo anh giong het, tranh tinh trang them anh moi ma van bi tra ve ket qua cu.
   */
  private async computeHash(
    deviceType: string | undefined,
    issueDescription: string,
    images: TicketAttachment[],
  ): Promise<string> {
    const imageKey = images
      .map((img) => img.id)
      .sort()
      .join(',');
    const normalized = `${(deviceType || '').trim().toLowerCase()}|${issueDescription
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')}|${imageKey}`;
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Parse JSON tu Claude - vi day la text generation (khong phai structured output
   * API rieng), can tu ve sinh: bo markdown code fence neu co, kiem tra dung schema
   * truoc khi tra ve, tranh lam sap ung dung neu AI tra ve sai dinh dang.
   */
  private parseAndValidate(rawText: string): {
    probableCauses: ProbableCause[];
    recommendedPartsToPrepare: string[];
  } {
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed.probableCauses)) {
      throw new Error('Response khong dung schema (thieu probableCauses)');
    }

    return {
      probableCauses: parsed.probableCauses.map((c: any) => ({
        cause: String(c.cause || 'Khong xac dinh'),
        probability: Math.max(0, Math.min(100, Number(c.probability) || 0)),
        suggestedAction: String(c.suggestedAction || ''),
      })),
      recommendedPartsToPrepare: Array.isArray(parsed.recommendedPartsToPrepare)
        ? parsed.recommendedPartsToPrepare.map(String)
        : [],
    };
  }
}
