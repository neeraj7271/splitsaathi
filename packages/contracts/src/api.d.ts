import { z } from 'zod';
export declare const idSchema: z.ZodString;
export declare const startOtpSchema: z.ZodObject<{
    phoneE164: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneE164: string;
}, {
    phoneE164: string;
}>;
export declare const verifyOtpSchema: z.ZodObject<{
    challengeId: z.ZodString;
    code: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    challengeId: string;
    displayName?: string | undefined;
}, {
    code: string;
    challengeId: string;
    displayName?: string | undefined;
}>;
export declare const createGroupSchema: z.ZodObject<{
    name: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<["flat", "trip", "couple", "event", "business", "custom"]>>;
    baseCurrencyCode: z.ZodDefault<z.ZodString>;
    participants: z.ZodDefault<z.ZodArray<z.ZodObject<{
        displayName: z.ZodString;
        phoneE164: z.ZodOptional<z.ZodString>;
        role: z.ZodDefault<z.ZodEnum<["admin", "member", "viewer"]>>;
    }, "strip", z.ZodTypeAny, {
        displayName: string;
        role: "admin" | "member" | "viewer";
        phoneE164?: string | undefined;
    }, {
        displayName: string;
        phoneE164?: string | undefined;
        role?: "admin" | "member" | "viewer" | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    mode: "flat" | "trip" | "couple" | "event" | "business" | "custom";
    baseCurrencyCode: string;
    participants: {
        displayName: string;
        role: "admin" | "member" | "viewer";
        phoneE164?: string | undefined;
    }[];
}, {
    name: string;
    mode?: "flat" | "trip" | "couple" | "event" | "business" | "custom" | undefined;
    baseCurrencyCode?: string | undefined;
    participants?: {
        displayName: string;
        phoneE164?: string | undefined;
        role?: "admin" | "member" | "viewer" | undefined;
    }[] | undefined;
}>;
export declare const createExpenseSchema: z.ZodObject<{
    groupId: z.ZodString;
    description: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    expenseDate: z.ZodString;
    currencyCode: z.ZodDefault<z.ZodString>;
    payers: z.ZodArray<z.ZodObject<{
        participantId: z.ZodString;
        amountMinor: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        participantId: string;
        amountMinor: number;
    }, {
        participantId: string;
        amountMinor: number;
    }>, "many">;
    shares: z.ZodArray<z.ZodObject<{
        participantId: z.ZodString;
        shareType: z.ZodEnum<["equal", "exact", "percent", "weight", "itemized"]>;
        amountMinor: z.ZodOptional<z.ZodNumber>;
        weightNumerator: z.ZodOptional<z.ZodNumber>;
        weightDenominator: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        participantId: string;
        shareType: "exact" | "percent" | "equal" | "weight" | "itemized";
        amountMinor?: number | undefined;
        weightNumerator?: number | undefined;
        weightDenominator?: number | undefined;
    }, {
        participantId: string;
        shareType: "exact" | "percent" | "equal" | "weight" | "itemized";
        amountMinor?: number | undefined;
        weightNumerator?: number | undefined;
        weightDenominator?: number | undefined;
    }>, "many">;
    lineItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        amountMinor: z.ZodNumber;
        participantIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        amountMinor: number;
        label: string;
        participantIds: string[];
    }, {
        amountMinor: number;
        label: string;
        participantIds: string[];
    }>, "many">>;
    billAdjustments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        adjustmentType: z.ZodEnum<["tax", "gst_cgst", "gst_sgst", "service_charge", "tip", "discount", "rounding"]>;
        label: z.ZodString;
        amountMinor: z.ZodNumber;
        allocationBasis: z.ZodEnum<["subtotal_proportional", "equal", "manual", "taxable_items_only"]>;
    }, "strip", z.ZodTypeAny, {
        amountMinor: number;
        label: string;
        adjustmentType: "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";
        allocationBasis: "equal" | "subtotal_proportional" | "manual" | "taxable_items_only";
    }, {
        amountMinor: number;
        label: string;
        adjustmentType: "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";
        allocationBasis: "equal" | "subtotal_proportional" | "manual" | "taxable_items_only";
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    groupId: string;
    expenseDate: string;
    currencyCode: string;
    payers: {
        participantId: string;
        amountMinor: number;
    }[];
    shares: {
        participantId: string;
        shareType: "exact" | "percent" | "equal" | "weight" | "itemized";
        amountMinor?: number | undefined;
        weightNumerator?: number | undefined;
        weightDenominator?: number | undefined;
    }[];
    category?: string | undefined;
    lineItems?: {
        amountMinor: number;
        label: string;
        participantIds: string[];
    }[] | undefined;
    billAdjustments?: {
        amountMinor: number;
        label: string;
        adjustmentType: "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";
        allocationBasis: "equal" | "subtotal_proportional" | "manual" | "taxable_items_only";
    }[] | undefined;
}, {
    description: string;
    groupId: string;
    expenseDate: string;
    payers: {
        participantId: string;
        amountMinor: number;
    }[];
    shares: {
        participantId: string;
        shareType: "exact" | "percent" | "equal" | "weight" | "itemized";
        amountMinor?: number | undefined;
        weightNumerator?: number | undefined;
        weightDenominator?: number | undefined;
    }[];
    category?: string | undefined;
    currencyCode?: string | undefined;
    lineItems?: {
        amountMinor: number;
        label: string;
        participantIds: string[];
    }[] | undefined;
    billAdjustments?: {
        amountMinor: number;
        label: string;
        adjustmentType: "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";
        allocationBasis: "equal" | "subtotal_proportional" | "manual" | "taxable_items_only";
    }[] | undefined;
}>;
export type StartOtpRequest = z.infer<typeof startOtpSchema>;
export type VerifyOtpRequest = z.infer<typeof verifyOtpSchema>;
export type CreateGroupRequest = z.infer<typeof createGroupSchema>;
export type CreateExpenseRequest = z.infer<typeof createExpenseSchema>;
