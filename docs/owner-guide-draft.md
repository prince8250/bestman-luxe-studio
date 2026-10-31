# Owner Guide (draft)

Notes collected while building, turned into the final owner guide in spec 38.

## Receipt printer (spec 09)

The POS prints on an 80mm thermal receipt printer connected to the counter PC. Any printer that works with Windows works; the POS needs no special software.

### 1. Install the printer

1. Connect the printer to the PC (USB) and switch it on.
2. Install the Windows driver from the printer's box or the maker's website (search for the model name and "Windows driver"). Windows often installs a generic one by itself; the maker's driver is better because it can cut the paper.
3. Print a Windows test page: Start → Settings → Bluetooth & devices → Printers & scanners → the printer → Print test page.

### 2. Make it the default printer

1. In Printers & scanners, turn off **Let Windows manage my default printer**.
2. Choose the receipt printer → **Set as default**.

### 3. Paper size and cutting

1. In the printer's **Printing preferences**, choose the 80mm roll paper size (often called "80 x 297 mm", "Roll paper 80mm", or "72mm printable").
2. If there is a cutter setting, choose **Cut at end of page** (or "Cut each page"). The POS prints every copy as its own page, so each copy comes out separately.
3. If there is a setting to reduce or skip blank paper at the bottom, turn it on.

### 4. Print without the dialog (recommended)

Chrome can print receipts straight to the default printer, without showing the print window each time:

1. Right-click the desktop → New → Shortcut.
2. For the location, enter (one line):
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://<the studio's website>/pos/sale/new`
3. Name it **Bestman POS** and use this shortcut to open the POS every day.
4. Close every other Chrome window first: the setting only applies when Chrome is started from this shortcut.

To test: ring up a sale. The receipt should print by itself, and the New sale screen is ready for the next customer.

On a laptop with an ordinary printer, open any receipt and choose **A4 paper** at the top. Both copies then print on one A4 page with dashed lines to cut along. The choice is remembered on that device.

### 5. Copies and reprints

- Each sale prints the number of copies set in **Settings → Receipts** (2 by default): the customer's copy and a **STAFF COPY**.
- If more than one staff member worked on the sale, each of them gets their own STAFF COPY with their name on it.
- Printing a receipt again (the **Reprint** button after a sale, or from the receipt page) marks every copy **REPRINT**, so a reprint can never pass as a new sale.

### 6. Shop rule: no receipt, no service

- Every customer pays at the counter first and gets a receipt.
- A staff member starts work only when they are handed the STAFF COPY for that service, and keeps it.
- At closing, each staff member's STAFF COPY slips should match their count in the day report. A missing slip or an extra service means something was not rung up.

## When the internet or power is down (spec 12)

The POS needs the internet. When it cannot be reached, keep selling on paper and enter the sales later.

1. Print a few **paper sales sheets** in advance (New sale → Record a past sale → Print a blank paper sales sheet, or open `/pos/paper-sheet`) and keep them at the counter.
2. While the POS is down, write one row per sale: time, customer phone, service, staff, amount, and how they paid.
3. When the POS is back, open **New sale → Record a past sale**, choose the date, and for each row enter the time, the services and staff, and the payment, then **Save past sale**. Tick "Entered" on the sheet. The date stays chosen for the next row; type each row's time.
4. Past sales count on the day they really happened, are marked "Past sale" in the sales list, and the owner is told. The counter can go back as many days as Settings allows (3 by default); the owner up to 14 days.

Recommended (no setup in the POS): a backup mobile internet device (MiFi) for when the main internet fails, and a small UPS for the PC, the router, and the receipt printer, so a short power cut does not stop the counter.

## Closing the day (spec 17)

1. At closing time, open **Close day** (the button on the day card in the sidebar). Count every note and coin in the drawer, the opening float included, and type the total. Add the MoMo total shown on the MoMo phone for the day if you have it, and a note if something happened.
2. The POS does **not** show what it expects until the count is saved. This is on purpose: when the expected number is on the screen, people count towards it. Count first, then compare.
3. After **Close the day**, the screen shows what was counted, what the POS expected (opening float + cash sales, minus cash refunds), and the difference: green when it matches, red when it does not. It also shows the money per payment method and the services per staff member: compare them with each person's STAFF COPY slips.
4. **Print close slip** prints the figures on the receipt printer, with lines for "Counted by" and "Checked by". Keep the slips.
5. The day report downloads to the PC by itself (an HTML file to read or print and a CSV file for Excel), as an extra copy next to the automatic backups. The first time, Chrome may ask to **allow this site to download multiple files**: choose Allow.
6. A closed day stays closed. If the count was wrong, only the owner can **Reopen day** (with a reason); the first close stays in the history and the day is counted and closed again. A day that was missed can be closed the next morning: choose it in the list at the top of Close day.
7. The owner is told about every close (the day summary) and about any cash difference (when SMS is set up).
