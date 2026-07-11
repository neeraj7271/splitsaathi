import { z } from 'zod';

export const idSchema = z.string().uuid();

export const startOtpSchema = z.object({
  phoneE164: z.string().min(8).max(20)
});

export const verifyOtpSchema = z.object({
  challengeId: idSchema,
  code: z.string().regex(/^\d{6}$/),
  displayName: z.string().min(1).max(80).optional()
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(120),
  mode: z.enum(['flat', 'trip', 'couple', 'event', 'business', 'custom']).default('flat'),
  baseCurrencyCode: z.string().length(3).default('INR'),
  participants: z
    .array(
      z.object({
        displayName: z.string().min(1).max(80),
        phoneE164: z.string().min(8).max(20).optional(),
        role: z.enum(['admin', 'member', 'viewer']).default('member')
      })
    )
    .default([])
});

export const createExpenseSchema = z.object({
  groupId: idSchema,
  description: z.string().min(1).max(200),
  category: z.string().max(80).optional(),
  expenseDate: z.string(),
  currencyCode: z.string().length(3).default('INR'),
  payers: z.array(z.object({ participantId: idSchema, amountMinor: z.number().int() })).min(1),
  shares: z
    .array(
      z.object({
        participantId: idSchema,
        shareType: z.enum(['equal', 'exact', 'percent', 'weight', 'itemized']),
        amountMinor: z.number().int().optional(),
        weightNumerator: z.number().int().positive().optional(),
        weightDenominator: z.number().int().positive().optional()
      })
    )
    .min(1),
  lineItems: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        amountMinor: z.number().int(),
        participantIds: z.array(idSchema).min(1)
      })
    )
    .optional(),
  billAdjustments: z
    .array(
      z.object({
        adjustmentType: z.enum(['tax', 'gst_cgst', 'gst_sgst', 'service_charge', 'tip', 'discount', 'rounding']),
        label: z.string().min(1).max(80),
        amountMinor: z.number().int(),
        allocationBasis: z.enum(['subtotal_proportional', 'equal', 'manual', 'taxable_items_only'])
      })
    )
    .optional()
});

export type StartOtpRequest = z.infer<typeof startOtpSchema>;
export type VerifyOtpRequest = z.infer<typeof verifyOtpSchema>;
export type CreateGroupRequest = z.infer<typeof createGroupSchema>;
export type CreateExpenseRequest = z.infer<typeof createExpenseSchema>;
