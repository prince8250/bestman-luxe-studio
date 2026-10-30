# Bestman Luxe Studio — POS and Website

## Overview

Bestman Luxe Studio is a single-branch barbering and beauty studio in Kumasi, Ghana (Asafo area, near KsTU — confirm the exact address, see open questions). Services include haircuts, braiding, wigs, makeup, massage, nails, tattoos, waxing, facials, and pedicures. The services list is managed in the POS, never hardcoded.

This is a real client project. Correct money, correct staff records, and never losing data matter more than feature count.

## Two Systems, One Codebase

| | POS (main product) | Public website (showcase) |
| --- | --- | --- |
| Who uses it | An employee at the counter PC (counter account) and the owner (owner account, often from their phone) | Anyone on the internet, mostly on phones |
| Login | Owner account + one counter account per employee (email + password) | None. No accounts, no login, no OTP, ever |
| Purpose | Record sales, print receipts, track staff work, manage the catalog, see reports, receive bookings, keep backups | Show what the studio does, where it is, and let people book an appointment |
| Look | Light, clean dashboard (see `design-reference/pos/`) | Dark, photo-led, editorial (see `design-reference/site/`) |
| Route | `app/pos` (served at `/pos`, optionally `pos.<domain>` at launch) | `app/(site)` (served at `/`) |

They share **one database**, because the website must show the services, prices, gallery and offers the owner edits in the POS, and bookings made on the website must appear in the POS. They are separated by folders, layouts, design systems, and access rules. The public site never links to the POS.

## Roles

- **Owner**: full access to the POS from the counter PC or their phone: the catalog, prices, staff, reports, money, backups, and approving voids. Created by the developer.
- **Counter**: the employee who sits at the counter PC. Records sales, prints receipts, reassigns staff on today's sales, handles appointments, and closes the day. Cannot void sales (only request), cannot give discounts above a limit, cannot change prices or staff, and cannot see finances. One counter account per employee, created by the owner, so every action is traceable to a person.
- **Staff**: barbers, nail techs, stylists, therapists. They are **records in the POS, not users**. They never log in. The owner adds, edits, and removes them; the counter assigns them to jobs.
- **Visitor / customer**: uses the public website without logging in. At the studio they are served through the POS by the counter.

The exact rules are in the Permissions table in `architecture-context.md`.

## The POS Story (the main flow)

**Walk-in sale (most of the day):**

1. A customer walks in. The counter employee opens **New sale**.
2. They pick the **service** (for example Haircut), then the **staff member** the customer prefers (for example Kofi). More services can be added to the same sale (for example Haircut with Kofi plus Pedicure with Ama).
3. Optionally enters the customer's **phone number** (and name). A returning customer is recognized by phone.
4. They take **payment** (cash, MoMo, card, or a split) and confirm. **Paid means confirmed.** The sale is recorded the moment it is paid.
5. The **receipt prints in two copies**. The customer takes one to the staff member, and the staff member keeps it. The shop rule is **no receipt, no service**.

**Changing who did the work:**

6. If the customer ends up served by someone else (Kofi was busy, Kwame was free), the counter opens the sale and **reassigns that line to Kwame** (same day; after that only the owner can). Staff reports then credit Kwame, not Kofi. Every reassignment is kept in a change log with the time and a reason.

**Online bookings:**

7. A booking made on the website appears in the POS under **Appointments** with the customer's name, phone, service, preferred staff, and time, so the counter knows who is expected and when. New bookings are highlighted.
8. When that customer arrives, the counter opens the appointment and taps **Start sale**. A new sale opens prefilled with the booked service and staff. They can change the service or staff, takes payment, and prints the receipt. The appointment is then marked **Arrived**.
9. The counter can also add a booking when someone calls the studio, cancel a booking (with a reason), or mark a no-show.

**Closing the day:**

10. At closing the counter runs **Close day**: counts the cash in the drawer and enters it **before** the system shows what it expected. The difference is saved, a close slip prints, the day report downloads to the PC, and the owner gets an SMS summary of the day.

**Keeping the owner in control:**

11. A mistake that needs a sale removed becomes a **void request**. The owner gets an SMS and approves or rejects it from their phone.
12. The owner's **Activity** feed shows everything as it happens, with who did it: sales, discounts, reassignments, void requests, cancellations, backdated sales, sign-ins, day closes. Unusual events (void requests, a cash difference, a big discount, a backdated sale, the day not closed, backups failing) also come by SMS.

**Running the business (owner):**

13. The owner manages **services** (add, edit, change price, remove), **service categories**, **staff** (add, edit, remove), **gallery** pictures, **offers**, staff **working hours** (used by online booking), and **studio details** (phone, address, opening hours, receipt footer).
14. The **dashboard** shows revenue, number of services done, customers served, staff performance, busiest days, top services, payment methods, repeat customers, and today's appointments, for today, this week, this month, or a custom range.
15. **Reports** give day, week, and month summaries, a per-staff report, and an end-of-day report that can be printed and downloaded.
16. **Backups**: while the studio PC is on, it automatically saves a full backup and a readable day report into a folder on the PC (at start-up and every 2 hours, so the PC being off at night does not matter). Every week a full database backup is saved in the cloud, listed in the POS for download. See `backup-and-recovery.md`.

## The Website Story

1. A visitor lands on the home page and can immediately tap **Book**, **Call**, or **Get directions**. Book is always visible at the top.
2. One long page: hero, service categories, offers, About, gallery, location and contact, footer. Plus `/services` and `/gallery` pages.
3. **Book** opens `/book`: pick a service, then a staff member (or "No preference"), then a date and time slot, then enter **name and phone number**. Nothing else.
4. The booking is confirmed on screen with a **booking code**, and an **SMS** confirming the booking is sent to the phone number.
5. The booking immediately appears in the POS.

## Customer Records

The POS keeps one customer record per phone number (name, phone, visit history), created automatically from sales and bookings. Phone is optional at the counter, but entering it enables "returning customer" recognition and the repeat-customer figures. Customers never see or log in to their record.

## Features (Version 1)

### POS
- Owner and counter logins with server-enforced permissions; owner manages counter accounts
- New sale with multiple line items (service + staff + price), optional customer phone, split payments, receipt printing
- Sales history, sale detail, reprint; voids by the owner, void requests from the counter
- Reassign staff on a line (counter: same day), edit a line's price or service (owner), all with a reason and a change log
- Discount limit for the counter
- Close day with a blind cash count, close slip, and owner summary SMS
- Owner activity feed and SMS alerts
- Record a past sale (for sales written on paper during an internet or power outage)
- Customers keyed by phone number
- Staff, services, categories, gallery, offers, studio settings
- Staff working hours and time off (drives online availability)
- Appointments from the website: list, highlight new, start sale, phone bookings, cancel, no-show, block abusive numbers
- Dashboard (see `design-reference/pos/`)
- Reports: daily, weekly, monthly, custom range, per staff, end-of-day report, CSV download, print
- Backups: to the studio PC while it is on (start-up + every 2 hours), weekly to the cloud, manual download, backup status visible in the POS

### Public website
- Single-page home, `/services`, `/gallery`, mobile-first, with animations
- Online booking with name and phone only, bot protection, rate limits
- Confirmation page and confirmation SMS

## Scope

### In Scope
- Everything under Features (Version 1)
- One branch, in-studio services only
- Currency: Ghana cedis (GHS). Timezone: `Africa/Accra`

### Out Of Scope (Version 1) — see `feature-specs/later/`
- **Online deposits / Paystack** (moved to `later/`; bookings are free to make in v1)
- Offline POS mode (working with no internet). v1 uses "Record a past sale" as the fallback
- Staff logins and a staff app (staff are records, not users)
- Staff commission and payroll calculations (reports show jobs and revenue per staff; pay calculations come later)
- Customer accounts, OTP, "My bookings"
- Product inventory and stock (a free-text "custom item" line covers occasional product sales)
- Reminder SMS, marketing SMS, WhatsApp automation (a "Chat on WhatsApp" link is fine)
- Mobile van and home service modes
- Native mobile apps
- Multiple branches

## Success Criteria

1. At the counter, a walk-in sale with one service takes **under 30 seconds** from "New sale" to a printed receipt.
2. A sale can contain several services done by different staff, and each line credits the right staff member.
3. Reassigning a line from one staff member to another moves the job and its revenue in every staff report, and the change log shows who it moved from, to, when, and why.
4. Revenue in the dashboard and reports equals the sum of paid, non-voided sales, by day in Accra time. Nothing else changes revenue.
5. A website booking appears in the POS within a minute, and starting a sale from it takes one tap.
6. Two online bookings can never hold the same staff member at overlapping times.
7. On every day the PC is used, it ends up with a full backup file and a day report without anyone clicking anything, and the owner can see when the last one succeeded.
8. A weekly cloud backup exists, is listed in the POS, and has been **restored successfully at least once** into a test project before launch.
9. A visitor on a phone sees Book, Call, and Directions without scrolling, and can book with only a name and phone number.
10. The owner can add a service with a category, price, duration, and staff, and it appears on the website and in the booking flow.
11. A counter user cannot make a sale disappear, give a discount above the limit, or see the expected cash before counting. Every action they take shows in the owner's activity feed with their name.
