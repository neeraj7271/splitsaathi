import { Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import type { OcrAnalyzeInput, OcrAnalyzeResult, OcrLineItemCandidate, OcrProviderPort } from './ocr-provider.port';

@Injectable()
export class TesseractOcrProvider implements OcrProviderPort {
  async analyzeReceipt(input: OcrAnalyzeInput): Promise<OcrAnalyzeResult> {
    const rawText = input.rawText ?? (await this.readText(input));
    const items = parseReceiptLineItems(rawText);
    const confidence = items.length > 0 ? Math.min(0.92, 0.55 + items.length * 0.08) : 0.2;
    return {
      provider: 'tesseract',
      rawText,
      confidence,
      items,
      needsHumanReview: true
    };
  }

  private async readText(input: OcrAnalyzeInput): Promise<string> {
    if (!input.imageBuffer && !input.imageUri) {
      return '';
    }
    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(input.imageBuffer ?? input.imageUri!);
      return result.data.text;
    } finally {
      await worker.terminate();
    }
  }
}

export function parseReceiptLineItems(rawText: string, currencyCode = 'INR'): OcrLineItemCandidate[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .map((line) => {
      const match = line.match(/^(.+?)\s+(?:INR|Rs\.?|₹)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)$/i);
      if (!match) {
        return undefined;
      }
      const amountMinor = decimalToMinor(match[2]);
      if (amountMinor <= 0 || /total|subtotal|tax|gst|service|discount/i.test(match[1])) {
        return undefined;
      }
      return {
        label: match[1].trim(),
        amountMinor,
        currencyCode,
        confidence: 0.72
      };
    })
    .filter((item): item is OcrLineItemCandidate => Boolean(item));
}

function decimalToMinor(value: string): number {
  const cleaned = value.replace(/,/g, '');
  const [majorPart, minorPart = ''] = cleaned.split('.');
  const sign = majorPart.startsWith('-') ? -1 : 1;
  const major = Math.abs(Number.parseInt(majorPart, 10));
  const minor = Number.parseInt(minorPart.padEnd(2, '0').slice(0, 2), 10) || 0;
  return sign * (major * 100 + minor);
}
