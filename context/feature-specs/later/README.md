# Later (Not Version 1)

These are **not** part of version 1. Do not build any of them unless the developer explicitly says "build L1" (and so on). Each one is a short brief, not a full spec; when the developer picks one, write it up as a full numbered spec first and get approval.

## L1 · Online Deposits (Paystack)

Moved out of v1 because the developer's description of the website booking (enter details, get an SMS) has no payment step, and leaving it out lets the POS ship sooner.
- Per-service `payment_mode` (`pay_at_shop` or `deposit`) and `deposit_amount`.
- Appointment status `pending_payment` with a short hold; Paystack transaction initialized on the server; confirmation **only** by the verified, idempotent webhook (signature, reference, and amount checked).
- At the counter, the deposit is applied as a payment on the sale (`method = paystack_deposit`).
- Decide the no-show policy: forfeited deposits are real money, so they need their own report line ("forfeited deposits"), separate from service revenue.
- Refunds handled manually in the Paystack dashboard and recorded in the POS.
- Paystack account in the client's business name.

## L2 · Offline POS Mode

For internet outages: New sale keeps working with no connection.
- Sales queue in IndexedDB with a client-generated id; sync when back online (the `client_request_id` idempotency from v1 already makes re-sending safe).
- Temporary offline receipt numbers (for example `OFF-…`) mapped to real numbers on sync.
- Needs a cached catalog, a clear "offline" banner, and conflict rules (for example a service archived while offline).
- Until then, v1 uses "Record a past sale" with the paper sheet.

## L3 · Owner PIN on the Counter PC

Owner and counter roles are **in v1** (specs 03, 04, 07). What stays for later: when the owner is physically at the counter, unlocking owner actions with a short PIN on the counter's session instead of signing out and in. Also possible later: per-staff cash drawers, and CCTV timestamps linked to receipts.

## L4 · Staff Commission and Payouts

If staff are paid per job or by percentage: per-staff commission rates, payout reports per period, mark periods as paid, and lock reassignments on paid-out periods.

## L5 · Reminder SMS

A reminder SMS a few hours before each appointment, through `lib/sms`, sent by a scheduled job.

## L6 · Products and Stock

Selling hair products and wigs as stocked items with quantities, instead of v1's free-text custom item.

## L7 · Native Mobile App

The earlier plan: a React Native app after the website and POS are live, Google Play before the App Store.
