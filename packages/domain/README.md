# Domain Package

Owns pure financial and policy logic: money arithmetic, deterministic rounding, split strategies, settlement optimization, settlement state transitions, UPI URI construction, role authorization policy, and balanced ledger posting validation.

Does not own NestJS, TypeORM, HTTP, filesystem, provider SDKs, or mobile UI concerns. This package must remain framework-free so the same invariants can be tested quickly and reused by API adapters.

Public interface:

- `RoundingAllocator`
- split strategy classes
- `BalancedPostingSet`
- `GreedySettlementOptimizer`
- `SettlementStateMachine`
- `UpiUriBuilder`
- `AuthorizationPolicy`
