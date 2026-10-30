# UI Context

There are **two design systems** in this project, one per system. They share fonts and a few rules, and nothing else.

| | Public website | POS |
| --- | --- | --- |
| Reference | `design-reference/site/01`–`05` | `design-reference/pos/01-dashboard-reference.png` |
| Feel | Dark, photo-led, editorial, square corners | Light, clean, calm dashboard, rounded cards |
| Device priority | Phone first (375px) | **Desktop first** (1280–1440px, the counter PC), works on a tablet, dashboard and appointments readable on a phone |
| Motion | Slow, smooth reveals | None decorative; quick state feedback only |
| Tokens | `--site-*` | `--pos-*` |
| Brand wrappers | `components/brand-site/` | `components/brand-pos/` |

Before building any UI spec, **look at the relevant reference images**. They are references for look, structure, and feel. Do not copy text, logos, product names, or photos from them.

## Fonts (both systems)

The developer chose **Bebas Neue** as the main font. Bebas Neue is a tall, condensed, **capitals-only** display face with a single weight. It is superb for headlines, numbers, and buttons, and unreadable for paragraphs, tables, and form fields. So:

| Role | Font | Where |
| --- | --- | --- |
| Display (the main voice) | **Bebas Neue** 400 | Website: hero name, section headings, panel titles, nav links, buttons, prices, booking codes. POS: page titles, card titles, KPI numbers, the New sale total, receipt header |
| Text | **Inter** (variable, 400–700) | Everything people read or type: body copy, labels, table cells, inputs, helper text, receipts body |

- Load both with `next/font/google` and expose as `--font-display` and `--font-text`.
- Bebas Neue is set with slight positive tracking (about 0.02em–0.06em) and tight line height (0.9–1.05). Do not apply `uppercase` to it; it is already caps. Do not fake bold with `font-bold`.
- Never set Bebas Neue below about 18px.
- Numbers in tables use Inter with `tabular-nums` so columns line up.
- This replaces the earlier Noto Serif / Open Sans / Oswald choice.

## Studio Logo

`studio-assets/logo/bestman-logo.jpg`: a black silhouette in a white circle with "Bestman luxe studio" in a script. It is the crest on the website hero, the POS sidebar mark, the favicon source, and (converted to black and white) the receipt header. The current file is a JPG on a dark background; a clean PNG or SVG with transparency is an open question. Until then, use the JPG as-is on dark backgrounds only.

---

# Part 1: Public Website

## The Feel In One Paragraph

Dark, confident, and photo-led. The interface is almost colorless: pure black, charcoal, white, and one off-white "paper" tone. **The photography carries the color.** The studio's own photos are warm and gold-lit (wood-slat walls, gold lighting, black-and-yellow capes), which looks rich against black. Type is big Bebas Neue. Corners are square. Premium through restraint: no gold UI decoration, no glow, no glassmorphism, no rounded bubbly cards.

## What The Site Reference Shows

**Hero (`01`, `05`).** Full-bleed black screen with a dark, moody photo behind it. Centered: the studio crest (logo), then **BESTMAN LUXE STUDIO** in very large Bebas Neue, then a single **BOOK NOW** button (charcoal fill, thin gray border, Bebas Neue, square). A thin vertical rail of social icons on the far left on desktop. On a phone, **Call** and **Directions** appear as secondary actions visible without scrolling.

**Navigation.** A floating bar centered at the top, narrower than the screen, charcoal and slightly translucent, with a thin white line along its top edge. Links in Bebas Neue, widely tracked. The current section is underlined. **Book** is always at the right end (top right on mobile). It stays on screen while scrolling.

**Service panels (`02`, `05`).** Tall full-bleed photo panels, two side by side on desktop (the second starts lower, staggered), stacked edge to edge on mobile. Dark overlay; centered title in Bebas Neue, one-line subtitle in Inter, outlined **SEE MORE** button.

**About block (`03`).** The one light section: off-white paper with a very subtle speckle. Photo on the left (the studio interior), heavy Bebas Neue headline on the right, short black rule, a subheading, short paragraphs, and a solid dark button. Photo stacks above on mobile.

**Gallery mosaic (`03`, `04`).** A tight mosaic separated by thin black gutters (8–14px). Mixed tile sizes. The studio's photos are mostly **portrait phone shots**, so the mosaic favors tall tiles with the occasional wide tile. Nothing rounded.

## Site Color Tokens

CSS custom properties in `globals.css` under a `.site` scope (or `[data-theme="site"]`), mapped through `@theme inline`. No hardcoded hex values in components.

| Role | Variable | Value |
| --- | --- | --- |
| Page background | `--site-bg` | `#000000` |
| Surface | `--site-surface` | `#111111` |
| Floating bar | `--site-bar` | `#161616` (about 90% opacity) |
| Button fill | `--site-button` | `#1c1c1c` |
| Paper | `--site-paper` | `#f4f3f0` |
| Border | `--site-border` | `#3a3a3a` |
| Button border | `--site-border-button` | `#5b5b5b` |
| Strong border | `--site-border-strong` | `#ffffff` |
| Text on dark | `--site-text` | `#ffffff` |
| Muted on dark | `--site-text-muted` | `#a6a6a6` |
| Text on paper | `--site-text-paper` | `#0b0b0b` |
| Muted on paper | `--site-text-paper-muted` | `#55555a` |
| Error / success | `--site-error`, `--site-success` | `#e5484d`, `#3fb97a` |

No accent color. Selection is shown by inversion (white fill, black text). Focus ring: 2px white (black on paper) with offset.

## Site Photo Treatment

- Text over photos always gets a dark overlay (35–50% black, or a bottom-weighted gradient).
- `object-cover` with a deliberate focal point (faces and haircuts are usually in the upper half of the studio's portrait photos).
- Real studio photos are in `studio-assets/photos/` (see its README). Some have the studio's own watermark; that is fine. Never use stock photos of other businesses.
- **No video in v1.** The studio's clips are low-resolution vertical phone videos with an editing-app watermark, and video is heavy on mobile data. If the developer wants video later, it is tap-to-play only, never autoplay in the hero.

## Site Layout Rules

- Design at **375px first**. Check 360, 390, 768, 1280.
- Book reachable without scrolling on every page, with one thumb.
- Tap targets at least 44×44px; body text at least 16px; inputs at least 16px (stops iOS zoom).
- `next/image` with responsive sizes, lazy below the fold. Photos are the main performance risk.

## Site Buttons

- **Solid**: `--site-button` fill, 2px `--site-border-button`, white Bebas Neue, square. Hover: border white, fill slightly lighter.
- **Outline**: transparent, 1px white border, white Bebas Neue. Hover: white fill, black text.
- Pressed: slight shift down, never a bounce. Transitions 200ms.

## Site Motion And Animation

The developer wants a few tasteful animations. Slow, smooth, expensive, never busy. CSS and Intersection Observer first. The `motion` package is **pre-approved for the website only**, loaded only in the components that need it, when CSS cannot do the effect cleanly.

- **Hero load**: crest fades and scales from 0.96, then the studio name rises 24px with a fade, then Book Now, each about 150ms apart, 800ms total.
- **Big headline reveal**: section headings in Bebas Neue reveal with a line-by-line slide up behind a mask as they enter the viewport.
- **Scroll reveal**: sections fade up 24px, once only. Gallery tiles stagger.
- **Panel hover (desktop)**: photo scales to about 1.04 over 600ms, overlay darkens slightly. No hover effects on touch.
- **Nav**: bar becomes slightly more opaque after scrolling; active section underline slides.
- **Gallery viewer**: fade with scale 0.98 → 1; swipe on touch.
- **Booking flow**: steps slide horizontally a little with a fade; the sticky summary never jumps.
- Respect `prefers-reduced-motion` (fades only, no transforms).
- Animate only `opacity` and `transform`. No scroll-jacking, no parallax-heavy effects, nothing that delays reaching Book.

## Site Pages

**Home**: hero → service category panels → offers (only when active) → About (paper) → gallery mosaic with See More → location and contact (address, opening hours, big Call, Directions, map link, WhatsApp link) → footer (logo, quick links, socials, copyright).

**`/services`**: black page; each category heading followed by service rows: small photo, name (Inter bold), duration and price (Bebas Neue), and a solid Book button that opens `/book?service=<id>`. Services that are not bookable online show "Walk in or call" instead of Book.

**`/gallery`**: the full mosaic and the full-screen viewer.

**`/book`**: dark, focused. Thin stepper in Bebas Neue: SERVICE · STAFF · TIME · YOUR DETAILS · CONFIRM. One decision per screen on mobile. Service and staff as photo tiles (selected tile inverts to white). Time slots as square outlined chips grouped Morning / Afternoon / Evening. Details: two big fields, name and phone. Sticky bottom bar: selection summary, price ("Pay at the studio"), and the main button.

**`/booking/[token]`**: black, centered: crest, "BOOKING CONFIRMED", the booking code very large in Bebas Neue, summary (service, staff, date and time, "Pay at the studio"), Call and Directions buttons, and a line: "Show this code at the studio."

---

# Part 2: POS

## The Feel In One Paragraph

The POS follows `design-reference/pos/01-dashboard-reference.png`: a calm, light, modern dashboard. Light gray page, white sidebar, white cards with soft rounded corners and hairline borders, generous padding, one blue accent, green and red only for up and down changes. It is a **tool used all day at the counter**, so clarity and speed beat decoration. Bebas Neue gives it the studio's voice in titles and big numbers; Inter does all the reading.

## Mapping The Reference To This Studio

| Reference element | Bestman POS version |
| --- | --- |
| Sidebar: Dashboard, Orders (46), Products, Customers, Content, Online Store, Finances (Invoices, Transactions, Reports), Analytics, Discounts | **Owner**: New sale (primary button at the top), Dashboard, Activity (badge = unread, red dot for pending void requests), Sales, Appointments (badge = new bookings), Customers, Staff, Services, Gallery, Offers, Reports (Daily, Weekly, Monthly, Staff, Changes), Backups, Settings. **Counter**: New sale, Today, Sales (today), Appointments, Customers, Close day. Items a role cannot use are not shown at all |
| "Upgrade to Premium" card | Owner: **Backup status** card (last PC backup, last cloud backup; red when stale). Counter: **Day status** card ("Day open since 08:12" or "Day closed") with a Close day button |
| Search bar with ⌘K | **Find**: receipt number, booking code, or customer phone. `Ctrl+K` focuses it |
| Date range + "Last 30 days" + Add widget + Export | Date range picker (Today, This week, This month, Last 30 days, Custom) + **Export** (CSV / print of that period). No "Add widget" |
| KPI tiles: Page Views, Visitors, Click, Orders | **Revenue**, **Services done**, **Customers served**, **Online bookings** (each with % change vs previous period, green up / red down pill) |
| Total Profit chart + Customers strip (Retailers, Distributors, Wholesalers) | **Revenue** line chart (current period solid blue with light area fill, previous period dashed gray) + strip: **Walk-in / Online booking / Phone booking** counts with colored underline bars |
| Most Day Active bar chart | **Busiest days**: revenue or services by weekday, the top day highlighted in blue |
| Repeat Customer Rate gauge | **Repeat customers**: share of identified customers in the period who had visited before |
| Best Selling Products table (ID, Name, Sold, Revenue, Rating) | **Top staff** table (photo, name, title, services done, revenue, top service) and **Top services** table (name, times done, revenue) |
| AI Assistant card | **Today's appointments**: next arrivals with time, name, service, staff, "Start sale" button |
| (not in reference) | **Payment methods** card: cash, MoMo, card split |

## POS Color Tokens

Under a `.pos` scope (or `[data-theme="pos"]`).

| Role | Variable | Value |
| --- | --- | --- |
| Page background | `--pos-bg` | `#f4f5f7` |
| Card / sidebar | `--pos-surface` | `#ffffff` |
| Subtle fill (hover rows, inactive bars) | `--pos-subtle` | `#eef0f3` |
| Hairline border | `--pos-border` | `#e6e8ec` |
| Text | `--pos-text` | `#0f1115` |
| Muted text | `--pos-text-muted` | `#6b7280` |
| Accent (primary buttons, active nav, chart line) | `--pos-accent` | `#2563eb` |
| Accent soft (active nav fill, area fill) | `--pos-accent-soft` | `#e8f0fe` |
| Up / success | `--pos-up`, `--pos-up-soft` | `#16a34a`, `#e7f7ed` |
| Down / error | `--pos-down`, `--pos-down-soft` | `#dc2626`, `#fdecec` |
| Warning | `--pos-warning` | `#d97706` |
| Chart series 2–4 | `--pos-chart-2..4` | `#16a34a`, `#f97316`, `#8b5cf6` |

The accent is one variable. If the owner prefers the studio's teal (seen on their van and Instagram), change `--pos-accent` and `--pos-accent-soft` only.

## POS Shape And Layout

- Cards: `--pos-surface`, 1px `--pos-border`, radius **16px**, padding 20–24px, **no heavy shadows** (at most a 1px soft shadow).
- Buttons and inputs: radius **10px**, height at least 44px (48px on New sale).
- Sidebar 240px on desktop, collapsible to icons; on tablet it collapses; on phone it becomes a bottom bar with Dashboard, New sale, Appointments, Sales, More.
- Data shows as tables on desktop and cards on phone.
- Page title in Bebas Neue (about 32–40px) at the top left of the content, actions top right.
- Every list and chart has designed loading (skeleton blocks), empty, and error states.

## Role Home Pages

- **Owner** lands on the Dashboard. On a phone, the Activity feed and the void-request approvals must be quick to reach (bottom bar: Dashboard, Activity, Appointments, Sales, More).
- **Counter** lands on **New sale**. Their **Today** page shows today's sales list (receipt, time, services, staff, payment method) and today's appointments, with **no money totals and no expected cash**.
- The signed-in user's name and role are always visible in the top bar, so nobody forgets which account is signed in.

## Permission-Aware UI

- Hide what a role cannot do; never show a disabled button that invites guessing. Where a counter action needs the owner, say it plainly: "Request void (the owner will approve)", "Discount above 20% needs the owner".
- A sale with a pending void request shows an amber "Void requested" badge everywhere it appears.

## The New Sale Screen (most important screen in the project)

Built for speed with a mouse and keyboard at the counter, still usable by touch.

- **Left (about 60%)**: category tabs, then a grid of large service tiles (name, price in Bebas Neue, duration). Search box at the top (type "hair" → filter). Clicking a service adds a line.
- Each line asks for the **staff member** right away: a row of staff photo chips (staff assigned to that service first, then "Other staff"). One click picks.
- **Right (about 40%)**, the ticket: customer phone field (recognizes returning customers and fills the name, shows visit count), lines (service, staff chip, price; edit price opens a small dialog that requires a reason), subtotal, discount, **TOTAL in big Bebas Neue**, payment method buttons (Cash, MoMo, Card, Split), cash tendered with change shown, and one dominant **CONFIRM & PRINT** button.
- Keyboard: `Ctrl+K` find, `/` service search, `Enter` confirm when valid, `Esc` cancel dialogs.
- After confirming: the receipt opens and prints, and the screen resets to an empty ticket.

## Close Day Screen

Step 1: "Count the cash in the drawer" with one big amount field (and an optional MoMo total and note). The expected amount is **not shown**. Step 2, after saving: counted, expected, and the difference in large Bebas Neue (green for zero, red otherwise), sales count, totals by method, services per staff, and buttons to print the close slip and download the day report. Plain, calm, no animation.

## Activity Feed (owner)

A reverse-chronological list grouped by day: icon, one plain sentence ("Abena reassigned Haircut on BLS-000412 from Kofi to Kwame: Staff was busy"), time, and a link to the item. Filters by type and by counter account. Void requests appear at the top with Approve and Reject buttons until decided. Unusual events (void requests, cash differences, big overrides, backdated sales, after-close sales) get an amber marker. Updates live.

## POS Receipt (80mm)

Black and white only. Logo (black and white) and studio name, address, phone. Receipt number, date and time. Customer name (if given). Lines: service, staff ("Served by Kwame"), price. "Served at the counter by Abena" (the counter account's display name). Subtotal, discount, total. Payments, cash tendered and change, MoMo reference. Footer text from settings, socials, "Book online at …". "REPRINT" mark on reprints. The second copy is marked "STAFF COPY". A4 fallback layout.

## POS Motion

None decorative. Quick (150ms) transitions for dialogs, toasts for saved and error, a gentle highlight on a newly arrived booking row, and a short sound (toggle in Settings) when a new online booking arrives.

---

## Shared Rules

- shadcn/ui is the behavior and accessibility base (`components/ui/`, never edited). Each system styles it through its own wrappers.
- Lucide React icons, stroke only. Sizes `h-4 w-4` inline, `h-5 w-5` in buttons.
- Every interactive element has a visible focus state.
- If a design skill is available to the agent (for example a frontend-design skill), use it for craft, but **this file and the reference images win** when they disagree.
- When unsure on the website, choose the quieter, darker option. When unsure in the POS, choose the clearer, faster option.
