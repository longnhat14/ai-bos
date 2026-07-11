import { Injectable, Logger } from '@nestjs/common';
import { TicketsService } from '../tickets/tickets.service';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DIAGNOSTIC_MODEL = 'claude-haiku-4-5-20251001'; // nhanh, re, du cho bai toan phan loai xac suat loi

export interface ProbableCause {
  cause: string;
  probability: number; // 0-100
  suggestedAction: string;
}

export interface DiagnosticResult {
  ticketId: string;
  probableCauses: ProbableCause[];
  recommendedPartsToPrepare: string[];
  note: string;
}

/**
 * AI Diagnostic - Sprint 11.
 *
 * QUAN TRONG - dung nguyen tac da thong nhat: day CHI la GOI Y xac suat de
 * ky thuat vien chuan bi linh kien truoc, KHONG PHAI ket luan cuoi cung.
 * Ky thuat vien van phai tu chan doan thuc te khi den noi/nhan may.
 *
 * Sprint 11 (AI Knowledge) se bo sung du lieu SOP/lich su sua chua that
 * cua PCTech vao prompt de tang do chinh xac - hien tai (Sprint 10/11 rut gon)
 * chi dung kien thuc chung cua Claude, chua co du lieu rieng cua PCTech.
 */
@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger(DiagnosticService.name);

  constructor(private readonly ticketsService: TicketsService) {}

  async diagnose(tenantId: string, ticketId: string): Promise<DiagnosticResult> {
    const ticket = await this.ticketsService.findOne(tenantId, ticketId);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY chua cau hinh - khong the chan doan');
      return {
        ticketId,
        probableCauses: [],
        recommendedPartsToPrepare: [],
        note: 'Chua cau hinh ANTHROPIC_API_KEY, khong the goi AI chan doan.',
      };
    }

    const systemPrompt = `You are an AI Diagnostic Engine for a computer/IT repair business (PCTech/RemoteIT).
Given a customer's reported symptom (in Vietnamese or English), estimate the probable hardware/software causes.

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
- This is a SUGGESTION for the technician to prepare parts in advance, not a final diagnosis.`;

    const userPrompt = `Device: ${ticket.deviceType || 'khong ro'} ${ticket.deviceModel || ''}
Trieu chung khach hang bao: "${ticket.issueDescription}"`;

    try {
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
          messages: [{ role: 'user', content: userPrompt }],
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

      return {
        ticketId,
        probableCauses: parsed.probableCauses,
        recommendedPartsToPrepare: parsed.recommendedPartsToPrepare,
        note: 'Day la goi y tu AI, ky thuat vien can tu kiem tra thuc te khi den noi.',
      };
    } catch (err) {
      this.logger.error(`Loi khi chan doan ticket ${ticketId}: ${err.message}`);
      return {
        ticketId,
        probableCauses: [],
        recommendedPartsToPrepare: [],
        note: `Khong the chan doan tu dong luc nay (${err.message}). Vui long chan doan thu cong.`,
      };
    }
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
