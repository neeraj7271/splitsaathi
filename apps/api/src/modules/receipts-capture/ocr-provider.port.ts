export const OCR_PROVIDER = 'OCR_PROVIDER';

export interface OcrAnalyzeInput {
  receiptDraftId: string;
  attachmentId?: string;
  imageUri?: string;
  imageBuffer?: Buffer;
  rawText?: string;
  locale?: string;
}

export interface OcrLineItemCandidate {
  label: string;
  amountMinor: number;
  currencyCode: string;
  confidence: number;
}

export interface OcrAnalyzeResult {
  provider: string;
  rawText: string;
  confidence: number;
  items: OcrLineItemCandidate[];
  needsHumanReview: boolean;
}

export interface OcrProviderPort {
  analyzeReceipt(input: OcrAnalyzeInput): Promise<OcrAnalyzeResult>;
}
