# Expenses Module

The expenses module converts user expense commands into immutable ledger events.

## Supported commands

- Create expense with multiple payers.
- Revise an active expense by posting a delta between old and new postings.
- Void an expense by reversing its active postings.

## Split behavior

- Equal splits use deterministic largest-remainder allocation.
- Exact splits must sum to the paid total.
- Weight and percent splits are treated as rational weights.
- Itemized splits allocate each line item across assigned participants and can allocate adjustments equally or proportionally.

No command mutates the source expense row. Current expense state is a projection of event history.
