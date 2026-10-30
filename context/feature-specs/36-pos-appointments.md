# 36 · Appointments in the POS

## Goal

Website bookings show up at the counter, and the counter turns an arrival into a sale with one tap.

## Depends On

- `35-confirmation-page-and-sms.md`
- `11-edit-sale-and-reassign-staff.md`

## Who Can Use This

- Owner and counter. Blocking a number after a no-show: owner only.

## Scope (Build Only This)

- `/pos/appointments`: Today (timeline by staff and a simple list), Upcoming, Past; filters by staff and status; search by code or phone. New, unseen bookings are highlighted, counted in the sidebar badge, and play the optional sound. The list refreshes live (Supabase Realtime or polling every 30 seconds; pick the simpler and explain).
- Appointment detail: customer, phone (tap to call), service, staff, time, source, SMS status, notes.
- **Start sale**: opens New sale prefilled with the booked service and staff and the customer, linked by `appointment_id`. Paying sets the appointment to `arrived` and links `sale_id` in the same `create_sale` transaction. Service or staff can be changed before paying (for example Kofi is busy). The appointment keeps what was booked (service, staff, time) as a record of the booking; the sale's lines record what was actually done. Changing the service or staff on the ticket does not move the reservation before payment; once paid, the appointment is no longer `confirmed`, so its slot is released and the staff member's busy time online comes from the sale's lines and their durations (walk-in busy blocks, spec 31).
- **Add phone booking**: the counter or owner books a slot for someone who called (`source = phone`, same overlap rules).
- Cancel (reason, logged, shown in the owner's activity feed, frees the slot) and Mark no-show (the owner is offered to block the number).
- Wire the dashboard "Today's appointments" card and the Find box (booking codes).

## Out Of Scope

- Reminder SMS, rescheduling flows (cancel and rebook).

## Notes And Rules

- An appointment never becomes revenue by itself; only its sale does.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] A website booking appears in the POS within a minute and is highlighted until seen.
- [ ] Start sale opens a prefilled ticket; paying marks the appointment arrived.
- [ ] Cancelled and no-show appointments free their slot online.
- [ ] Typing a booking code in Find opens the appointment.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
