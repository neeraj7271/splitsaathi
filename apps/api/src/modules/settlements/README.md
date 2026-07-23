# Settlements Module

The settlements module owns the verified settlement lifecycle.

## Lifecycle

`suggested -> intent_created -> intent_generated -> payer_opened_upi_app -> proof_submitted -> awaiting_receiver_confirmation -> confirmed -> ledger_posted`

Notes:
- Opening a UPI app does not request receiver confirmation.
- Payee confirmation is required after proof submission (UTR / attachment).
- Only the payee can confirm or reject; only the payer can open UPI / submit proof.

Exception states are also first-class:

- `partial_detected`
- `duplicate_reference_review`
- `disputed`
- `rejected`
- `expired`
- `cancelled`
- `reversed`
- `refunded`

## UPI strategy

MVP settlement is payer-initiated. `UpiIntentProviderPort` generates a UPI URI/QR payload and `PaymentGatewayPort` is a provider abstraction for PSP reconciliation. Implementations: `manual` (dev), `cashfree` (preferred), and legacy `razorpay`.
