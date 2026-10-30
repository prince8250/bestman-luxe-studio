# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 0: Foundation.

## Current Goal

- `02-database-schema.md`.

## Completed

- **00 Project setup**: Next.js 16.4.3 (App Router, TypeScript strict, Tailwind v4, ESLint CLI), shadcn/ui (Radix base, `radix-nova` style) with the 12 listed components, Supabase JS + SSR, Zod, Lucide, Vitest. Scripts `lint`, `typecheck`, `test`, `build`. `lib/env.ts` + `lib/env.server.ts` validate env vars, checked at server start by `instrumentation.ts`. `.env.example`, `app/robots.ts` (disallows `/pos` and `/api`), placeholder `/` and `/pos`, folder skeleton, git with `main` and `dev`.
- **01 Themes, fonts, brand wrappers**: Bebas Neue + Inter via `next/font` (`lib/fonts.ts`, `--font-display` / `--font-text`). `--site-*` and `--pos-*` tokens in `app/globals.css`, each scope also re-pointing shadcn's variables. **Two root layouts** (`app/(site)/layout.tsx` with `<html class="site">`, `app/pos/layout.tsx` with `<html class="pos">`, noindex) so portaled dialogs keep the theme; `app/global-not-found.tsx` (experimental `globalNotFound`) serves the 404. Wrappers: `SiteButton`, `SiteHeading`, `PaperSection`, `Container`, `Reveal` (scroll reveal); `PosButton`, `PosCard`, `KpiTile` (+ skeleton), `PageHeader`. Logo: `tools/assets/make-logo.mjs` cuts the circle out of the JPG into `public/brand/logo-crest.png` (transparent), `public/brand/logo-receipt.png` (B&W), `app/icon.png`, `app/apple-icon.png`. Temporary `/design-check` and `/pos/design-check` (remove in spec 37). Checked at 375/1280 (site) and 1280/768/375 (POS) in the browser; reduced motion verified in the compiled CSS only (not emulated).

## In Progress

- None yet.

## Next Up

- `00-project-setup.md`, then `01-theme-fonts-and-tokens.md`, then `02-database-schema.md`.

## Build Order

Specs live in `context/feature-specs/`. Build in order unless the developer says otherwise. Tick a box only when the spec is fully done. **The POS comes first** because it is the product the studio runs on; the website follows.

**Phase 0: Foundation**
- [x] 00 Project setup
- [x] 01 Two themes, fonts, and brand wrappers
- [ ] 02 Database schema, functions, RLS, and seed data

**Phase 1: POS access**
- [ ] 03 POS login (owner and counter accounts)
- [ ] 04 POS shell, permissions, and Find

**Phase 2: POS catalog and settings**
- [ ] 05 Staff management
- [ ] 06 Services, categories, and prices
- [ ] 07 Studio settings and counter accounts

**Phase 3: POS core (the counter)**
- [ ] 08 New sale
- [ ] 09 Receipt printing
- [ ] 10 Sales history, voids, and void requests
- [ ] 11 Reassign staff and edit a paid sale
- [ ] 12 Record a past sale (outage fallback)
- [ ] 13 Customers

**Phase 4: Reports, close day, and owner oversight**
- [ ] 14 Report engine (SQL)
- [ ] 15 Dashboard
- [ ] 16 Reports: day, week, month, staff, changes
- [ ] 17 Close day (blind cash-up)
- [ ] 18 SMS adapter
- [ ] 19 Owner activity feed and SMS alerts

**Phase 5: Backups**
- [ ] 20 Backup export endpoints and manual download
- [ ] 21 Backup to the studio PC (while it is on)
- [ ] 22 Weekly cloud backup and the Backups page

**Milestone: the studio can start using the POS here**, before the website exists (see open question 11).

**Phase 6: Website content and public site**
- [ ] 23 Gallery management (POS)
- [ ] 24 Offers management (POS)
- [ ] 25 Website navbar
- [ ] 26 Website hero
- [ ] 27 Website services panels and page
- [ ] 28 Website gallery
- [ ] 29 Website offers, about, location, footer

**Phase 7: Online booking into the POS**
- [ ] 30 Staff working hours and time off
- [ ] 31 Availability engine
- [ ] 32 Website booking flow
- [ ] 33 Booking creation
- [ ] 34 Booking abuse protection
- [ ] 35 Confirmation page and SMS
- [ ] 36 Appointments in the POS

**Phase 8: Launch**
- [ ] 37 Polish: performance, SEO, accessibility
- [ ] 38 Deployment, restore drill, and handover

**Not in v1**: `feature-specs/later/` (deposits, offline mode, owner PIN on the counter PC, commission, reminders, products, mobile app).

## Resolved Questions

- **Who sits at the counter PC**: an employee. → Owner and counter roles with server-enforced permissions, void requests, a counter discount limit, blind cash-up, an owner activity feed, and SMS alerts (architecture "Access Model").
- **Studio PC**: Windows, **not** left on overnight. → PC backups run at log-on and every 2 hours while the PC is on, overwrite today's files, and finalize the previous day at the next start-up; Close day also downloads the day report in the browser (`backup-and-recovery.md` Layer 1).
- **Online deposits**: not in v1, confirmed. → `later/` L1.
- **17 Accent color in the POS**: reference blue `#2563eb` (developer, 2026-10-30).
- **2 Logo file**: no transparent file exists. The agent removes the dark background from `bestman-logo.jpg` itself (spec 01) and makes a black-and-white receipt version (developer, 2026-10-30).
- **3 Service list**: the developer supplied the real services (below). Prices and durations are **placeholders**, clearly marked; the owner sets the real ones in POS Services (developer, 2026-10-30).
  - Haircuts & Barbering: Haircuts, P-Cut, Boy Child Fringe
  - Hair Styling & Installation: Frontal Pony, Frontal Styling, Wig Installation, Weavon, Weavon Styling, Hair Washing
  - Facial & Skincare: Facial, Contour, Eyebrow Tattoo
  - Nails & Pedicure: Nail Services, Gel Polish, Acrylic Nails, Pedicure
  - Makeup & Beauty Enhancements: Makeup, Eyelashes, Piercing
  - Main business category: Beauty, Hair & Personal Care (Beauty Salon & Barbershop)
- **4 Staff list**: 4 sample staff (Kofi, Kwame, Ama, Efua), clearly marked. The owner adds the real staff in POS Staff (developer, 2026-10-30).
- **Sample data must be very easy to remove** (developer, 2026-10-30): all sample rows are removable in one step before real use (see spec 02 notes when built).
- **Dependencies**: the developer allowed adding dependencies as needed; each one is listed in the spec report (2026-10-30).
- **Open questions are asked one by one** as their spec comes up (developer, 2026-10-30).
- **GitHub repo stays public** (developer's choice, 2026-10-30), although `code-standards.md` says private. No secrets are committed; `.env.local` is gitignored.
- **Supabase**: new project `bestman-luxe-studio` (ref `xpcsmqwdpswnvzyterwx`, region Europe), the development database with sample data. "Automatically expose new tables" is off (migrations grant access explicitly) and automatic RLS is on. The other projects in the org (`luxe-studio`, `Maison`) are not used.

## Open Questions

Resolve each before the spec shown in brackets. Record the answer in the relevant context file, then remove it here. Defaults are what the agent assumes if the developer says "go with the default".

**Catalog and counter**
1. **Studio details** [07, 26, 29] Exact address and map pin (the studio's video says Asafo, near KsTU, Kumasi), phone, WhatsApp, opening hours, socials, about text.
5. **Counter employees** [07] How many people will use the counter PC, and their names (one counter account each). Is there a regular hand-over between shifts during the day? (Default: one close per day; shift hand-overs not tracked in v1.)
6. **Counter limits** [07, 08, 12] Maximum counter discount (default 20%), counter backdate limit (default 3 days), opening cash float (default: owner sets), cash difference tolerance (default GHS 0.00), alert threshold for overrides.
7. **Owner alerts** [19] Owner's phone number, which alerts by SMS (default: all on), daily SMS cap (default 20).
8. **Receipt printer** [09] Model and paper width (default 80mm thermal). Copies per sale (default 2: customer + staff copy).
9. **Customer phone at the counter** [08] Optional or required? (Default: optional, encouraged.)
10. **Staff pay** [11, 16] Are staff paid per job or by percentage? If yes, `later/` L4 becomes important. (Default: v1 reports counts and revenue per staff only.)
11. **Soft launch** [after 22] Start using the POS at the studio before the website is ready? (Default: yes; requires Supabase Pro and Vercel Pro from that point, see 13.)
12. **Products** [08] Does the studio sell products at the counter? (Default: occasional, via custom item; stock in `later/` L6.)

**Backups and hosting**
13. **Hosting cost** [22, 38] Production needs Supabase Pro (about $25/month, daily backups, no pausing) and Vercel Pro (Hobby is non-commercial only). The client must agree to pay. Recheck prices before quoting.
14. **Windows version and folder** [21] Windows 10 or 11? Backup folder (default `C:\BestmanBackups`), and can it sit inside a Google Drive or OneDrive desktop folder for an off-site copy?
15. **Internet and power at the studio** [12] A backup MiFi and a small UPS for the PC, router, and printer are strongly recommended (no code needed).

**Website and booking**
16. **SMS provider** [18] Arkesel, mNotify, or Hubtel; account, API key, sender ID. Needed earlier now, because owner alerts (spec 19) use it.
18. **"No preference" staff** [32] Allowed? (Default: yes.)
19. **Booking limits** [34] 2 upcoming bookings per phone and the documented rate limits. (Default: yes.)
20. **Turnstile** [34] Developer creates the free Cloudflare Turnstile site and keys.
21. **Website photos** [26–29] Use the starter photos in `studio-assets/photos/` (default yes), get the studio's OK for the people shown, and a few landscape and interior shots for the hero and About.

## Architecture Decisions

- **Two systems, one codebase**: POS (`app/pos`, main product) and website (`app/(site)`, no login). Shared database; strict folder, layout, and design separation.
- **POS-first build order.** The studio can start using the POS before the website exists.
- **Two POS roles**: owner (full access, often on a phone) and counter (one account per employee). One permissions map in `lib/auth/permissions.ts`, enforced in server actions and again in Postgres functions.
- **Counter controls**: void requests approved by the owner, a discount limit, same-day-only reassignment, a backdate limit, a blind cash count at close, a live activity feed, SMS alerts and a daily summary to the owner, and two receipt copies ("no receipt, no service").
- **Sales are separate from appointments.** A sale (receipt) with line items (service + staff + price) and payments is the only source of revenue. Appointments are reserved time slots.
- **Paid means confirmed** at the counter. No unpaid sales are stored.
- **Walk-in sales never fail because of schedules.** Only online appointments are protected by the overlap constraint.
- **Staff are records, not users.** Reassignment always needs a reason and is logged in an append-only `audit_log` with the actor.
- **Multi-row writes are Postgres functions** (one transaction each).
- **Three backup layers**: PC (log-on + every 2 hours while on, plus the browser copy at Close day), weekly `pg_dump` to a private bucket (GitHub Actions), Supabase Pro daily backups. Restore drill blocks launch.
- **Fonts**: Bebas Neue for display, Inter for reading, in both systems.
- **Website look**: dark, photo-led, square. **POS look**: light dashboard (Shopeers-style reference).
- No customer accounts, no OTP, no online deposits in v1.
- Money is integer pesewas; timezone `Africa/Accra`; week starts Monday.
- **Next.js 16 Cache Components off** (spec 00). `create-next-app` 16.4 enables `cacheComponents` by default; it forces every session read behind a Suspense boundary. The POS is per-user and dynamic, so the classic model (cookies make a route dynamic) is used for simpler, safer access checks.
- **shadcn/ui on the Radix base** (`radix-nova`), because the specs use the `asChild` pattern. shadcn's `cn` comes from its `cn` package (re-exported by `lib/utils.ts`).
- **Env split**: `lib/env.ts` (schemas + public vars, safe anywhere) and `lib/env.server.ts` (`server-only`, secrets).
- **Two root layouts** (spec 01): the website and the POS each own `<html>`, because Radix dialogs/selects portal into `<body>` and must inherit the right theme. Moving between them is a full page load, which is fine (the site never links to the POS).
- **POS radius**: use `rounded-[16px]` for cards; shadcn's radius scale is relative to `--radius` (10px in the POS), so `rounded-2xl` would be 18px.
- **Git**: work is pushed to `dev` after each spec; the developer merges `dev` into `main` after review.

## What Changed From Context Version 1

For the developer's reference; the agent should treat the current files as the only truth.
- Admin area rebuilt as **the POS**, the main product, built first, with **owner and counter roles**.
- `bookings` + "check-in revenue" replaced by `appointments` + `sales` / `sale_items` / `sale_payments`.
- Multi-service sales, a staff member per line, reassignment with a change log, voids and void requests, backdated sales, close day.
- New: dashboard per the POS reference, report engine, staff reports, end-of-day report, CSV exports, owner activity feed and SMS alerts.
- New: backups (`backup-and-recovery.md`, specs 20–22), restore drill.
- New: studio settings and counter accounts, phone bookings.
- Removed from v1: Paystack deposits (now `later/` L1).
- Fonts changed to Bebas Neue + Inter.

## Session Notes

- 2026-10-30: The developer asked for the whole project to be built spec by spec, pushing each finished spec to `dev`. Supabase org `lfsdjrvlfgypdlvhgyny`, Vercel team `princeappiah8250-9236s-projects`, GitHub user `prince8250`.
