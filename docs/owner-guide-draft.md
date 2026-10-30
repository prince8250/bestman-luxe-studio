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
