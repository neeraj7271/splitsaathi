import { Injectable } from '@nestjs/common';
import type { AutomationFeature, CoreLedgerCommand, EntitlementDecision } from './entitlements.types';

@Injectable()
export class EntitlementsService {
  evaluateCoreCommand(_userId: string, command: CoreLedgerCommand): EntitlementDecision {
    return {
      allowed: true,
      cap: null,
      reason: `${command} is a core ledger command and is not scarcity-capped.`
    };
  }

  evaluateAutomationFeature(_userId: string, feature: AutomationFeature): EntitlementDecision {
    return {
      allowed: false,
      cap: null,
      reason: `${feature} is reserved for a future automation entitlement; core ledger use remains unaffected.`
    };
  }
}
