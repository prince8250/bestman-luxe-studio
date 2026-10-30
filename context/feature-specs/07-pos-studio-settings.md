# 07 · Studio Settings and Counter Accounts

## Goal

One owner-only place for the studio's details, the counter controls, owner alerts, and the counter employees' accounts.

## Depends On

- `04-pos-shell.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- `/pos/settings` (owner only), sections:
  - **Studio**: name, phone, WhatsApp, address, map link, opening hours (simple text per day), social links, about text (used by the website), receipt header and footer, receipt copies (default 2: customer and staff copy), new-booking sound on or off.
  - **Counter controls**: maximum counter discount (percent, default 20), how many days back the counter may record a past sale (default 3), default opening cash float, cash difference tolerance (default GHS 0.00), override alert threshold.
  - **Owner alerts**: the owner's phone for SMS, and on/off toggles for each alert kind in `owner_alerts` (sending is built in spec 19; this only stores the choices).
  - **Counter accounts**: list counter users (display name, email, active, last sign-in); create a counter account (display name, email, temporary password); reset password; sign out of all devices; deactivate or reactivate. Uses the Supabase admin API in a server-only module.
- All changes write `audit_log` rows (never including passwords).

## Out Of Scope

- Backup settings (the PC script has its own config; spec 22 shows backup status).

## Notes And Rules

- The owner cannot deactivate or demote their own account from this screen.
- Seed values are sample data; the real details are an open question in the tracker.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Settings save and reload correctly; public views expose only public fields.
- [ ] The owner can create a counter account, and that person can sign in.
- [ ] Resetting a password or deactivating a counter account signs that account out everywhere.
- [ ] A counter user cannot open Settings or call any of its actions.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
