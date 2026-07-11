import { Injectable, Logger } from '@nestjs/common';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const TRANSLATION_MODEL = 'claude-haiku-4-5-20251001'; // model nhanh, re, phu hop dich real-time cho chat

// Ban do ma ngon ngu -> ten day du, dung trong prompt de model hieu ro hon la chi doc ma ISO
const LANGUAGE_NAMES: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  th: 'Thai',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
};

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  /**
   * Dich 1 doan text tu ngon ngu nguon sang ngon ngu dich, dung Claude API.
   * Giu nguyen thuat ngu ky thuat (mainboard, SSD, RAM...) khong dich sai nghia -
   * day la yeu cau quan trong da thong nhat khi thiet ke tinh nang nay.
   *
   * Neu API loi (mat mang, het quota...), tra ve NGUYEN VAN ban goc kem canh bao,
   * KHONG lam gian doan luong chat (nguoi tiep nhan van thay duoc tin, chi la chua dich).
   */
  async translate(text: string, sourceLangCode: string, targetLangCode: string): Promise<string> {
    if (sourceLangCode === targetLangCode) return text; // cung ngon ngu, khong can dich

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY chua duoc cau hinh - bo qua dich, tra ve ban goc');
      return text;
    }

    const sourceLangName = LANGUAGE_NAMES[sourceLangCode] || sourceLangCode;
    const targetLangName = LANGUAGE_NAMES[targetLangCode] || targetLangCode;

    const systemPrompt = `You are a translation engine embedded in a computer/IT repair support chat system (RemoteIT).
Translate the user's message from ${sourceLangName} to ${targetLangName}.

Rules:
- Preserve technical terms exactly (e.g. mainboard, SSD, RAM, IP address, firewall, VPN, driver, BIOS) - do not translate them into unrelated words.
- Keep the tone natural and appropriate for customer support chat.
- Respond with ONLY the translated text. No explanations, no quotation marks, no preamble.`;

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: TRANSLATION_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: text }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic API tra ve loi ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const translatedText = data.content?.[0]?.text?.trim();

      if (!translatedText) {
        throw new Error('Anthropic API tra ve response rong');
      }

      return translatedText;
    } catch (err) {
      this.logger.error(`Loi khi dich (${sourceLangCode} -> ${targetLangCode}): ${err.message}`);
      return text; // fallback: tra ve ban goc, khong chan luong chat
    }
  }
}
