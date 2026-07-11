"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpenseSchema = exports.createGroupSchema = exports.verifyOtpSchema = exports.startOtpSchema = exports.idSchema = void 0;
const zod_1 = require("zod");
exports.idSchema = zod_1.z.string().uuid();
exports.startOtpSchema = zod_1.z.object({
    phoneE164: zod_1.z.string().min(8).max(20)
});
exports.verifyOtpSchema = zod_1.z.object({
    challengeId: exports.idSchema,
    code: zod_1.z.string().regex(/^\d{6}$/),
    displayName: zod_1.z.string().min(1).max(80).optional()
});
exports.createGroupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120),
    mode: zod_1.z.enum(['flat', 'trip', 'couple', 'event', 'business', 'custom']).default('flat'),
    baseCurrencyCode: zod_1.z.string().length(3).default('INR'),
    participants: zod_1.z
        .array(zod_1.z.object({
        displayName: zod_1.z.string().min(1).max(80),
        phoneE164: zod_1.z.string().min(8).max(20).optional(),
        role: zod_1.z.enum(['admin', 'member', 'viewer']).default('member')
    }))
        .default([])
});
exports.createExpenseSchema = zod_1.z.object({
    groupId: exports.idSchema,
    description: zod_1.z.string().min(1).max(200),
    category: zod_1.z.string().max(80).optional(),
    expenseDate: zod_1.z.string(),
    currencyCode: zod_1.z.string().length(3).default('INR'),
    payers: zod_1.z.array(zod_1.z.object({ participantId: exports.idSchema, amountMinor: zod_1.z.number().int() })).min(1),
    shares: zod_1.z
        .array(zod_1.z.object({
        participantId: exports.idSchema,
        shareType: zod_1.z.enum(['equal', 'exact', 'percent', 'weight', 'itemized']),
        amountMinor: zod_1.z.number().int().optional(),
        weightNumerator: zod_1.z.number().int().positive().optional(),
        weightDenominator: zod_1.z.number().int().positive().optional()
    }))
        .min(1),
    lineItems: zod_1.z
        .array(zod_1.z.object({
        label: zod_1.z.string().min(1).max(120),
        amountMinor: zod_1.z.number().int(),
        participantIds: zod_1.z.array(exports.idSchema).min(1)
    }))
        .optional(),
    billAdjustments: zod_1.z
        .array(zod_1.z.object({
        adjustmentType: zod_1.z.enum(['tax', 'gst_cgst', 'gst_sgst', 'service_charge', 'tip', 'discount', 'rounding']),
        label: zod_1.z.string().min(1).max(80),
        amountMinor: zod_1.z.number().int(),
        allocationBasis: zod_1.z.enum(['subtotal_proportional', 'equal', 'manual', 'taxable_items_only'])
    }))
        .optional()
});
//# sourceMappingURL=api.js.map