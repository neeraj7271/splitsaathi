export interface NetBalance {
    participantId: string;
    amountMinor: number;
    currencyCode: string;
}
export interface SettlementSuggestion {
    payerParticipantId: string;
    payeeParticipantId: string;
    amountMinor: number;
    currencyCode: string;
    explanation: string;
}
export declare class GreedySettlementOptimizer {
    suggest(balances: NetBalance[]): SettlementSuggestion[];
}
