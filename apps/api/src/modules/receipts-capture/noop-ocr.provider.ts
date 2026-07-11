import { Injectable } from '@nestjs/common';
import type { OcrAnalyzeInput, OcrAnalyzeResult, OcrProviderPort } from './ocr-provider.port';

@Injectable()
export class NoopOcrProvider implements OcrProviderPort {
  async analyzeReceipt(input: OcrAnalyzeInput): Promise<OcrAnalyzeResult> {
    return {
      provider: 'noop',
      rawText: '',
      confidence: 0,
      items: [],
      needsHumanReview: Boolean(input.receiptDraftId)
    };
  }
}
