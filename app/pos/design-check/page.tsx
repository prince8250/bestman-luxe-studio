import type { Metadata } from "next";
import { CalendarCheck, Download, Receipt, Scissors, Users } from "lucide-react";

import { KpiTile, KpiTileSkeleton } from "@/components/brand-pos/kpi-tile";
import { PageHeader } from "@/components/brand-pos/page-header";
import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// TEMPORARY (spec 01): shows every POS wrapper, token, and type size.
// Remove in spec 37.
export const metadata: Metadata = { title: "Design check" };

const swatches = [
  { name: "--pos-bg", className: "bg-pos-bg" },
  { name: "--pos-surface", className: "bg-pos-surface" },
  { name: "--pos-subtle", className: "bg-pos-subtle" },
  { name: "--pos-border", className: "bg-pos-border" },
  { name: "--pos-text", className: "bg-pos-text" },
  { name: "--pos-text-muted", className: "bg-pos-text-muted" },
  { name: "--pos-accent", className: "bg-pos-accent" },
  { name: "--pos-accent-soft", className: "bg-pos-accent-soft" },
  { name: "--pos-up", className: "bg-pos-up" },
  { name: "--pos-up-soft", className: "bg-pos-up-soft" },
  { name: "--pos-down", className: "bg-pos-down" },
  { name: "--pos-down-soft", className: "bg-pos-down-soft" },
  { name: "--pos-warning", className: "bg-pos-warning" },
  { name: "--pos-chart-3", className: "bg-pos-chart-3" },
  { name: "--pos-chart-4", className: "bg-pos-chart-4" },
];

export default function PosDesignCheckPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader
        title="Design check"
        description="Every POS wrapper, token, and type size (temporary page)."
        actions={
          <>
            <PosButton variant="secondary">
              <CalendarCheck /> Last 30 days
            </PosButton>
            <PosButton>
              <Download /> Export
            </PosButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Revenue"
          value="GHS 4,230.00"
          change={15.5}
          caption="vs. GHS 3,662.00 last period"
          icon={<Receipt />}
        />
        <KpiTile label="Services done" value="38" change={-10.5} caption="vs. 42 last period" icon={<Scissors />} />
        <KpiTile label="Customers served" value="31" change={0} caption="vs. 31 last period" icon={<Users />} />
        <KpiTile label="Online bookings" value="0" change={null} caption="No earlier period yet" icon={<CalendarCheck />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PosCard title="Buttons" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <PosButton>Primary</PosButton>
            <PosButton variant="secondary">Secondary</PosButton>
            <PosButton variant="ghost">Ghost</PosButton>
            <PosButton variant="danger">Void sale</PosButton>
            <PosButton disabled>Disabled</PosButton>
            <PosButton size="lg">Confirm &amp; print (48px)</PosButton>
          </div>
        </PosCard>
        <PosCard title="Loading state">
          <KpiTileSkeleton className="border-dashed" />
        </PosCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PosCard title="Type">
          <p className="display-type text-[2.5rem]">Page title 40px</p>
          <p className="display-type text-2xl">Card title 24px</p>
          <p className="display-type text-5xl tabular-nums">GHS 446.70</p>
          <p className="mt-3 text-sm">Body, labels, and table cells are Inter 14px.</p>
          <p className="text-xs text-pos-text-muted">Muted helper text 12px.</p>
          <p className="mt-2 text-sm tabular-nums">1,230 · 812 · 46 (tabular numbers)</p>
        </PosCard>

        <PosCard title="Form controls">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Customer phone</Label>
              <Input id="phone" placeholder="024 123 4567" className="h-11 rounded-[10px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select defaultValue="cash">
                <SelectTrigger className="h-11 w-full rounded-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="momo">MoMo</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <PosButton variant="secondary" fullWidth>
                  Open dialog
                </PosButton>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change price</DialogTitle>
                  <DialogDescription>A reason is required for every price change.</DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
        </PosCard>

        <PosCard title="Empty and error states">
          <div className="rounded-[10px] border border-dashed border-pos-border p-6 text-center">
            <p className="font-medium">No sales yet today</p>
            <p className="mt-1 text-sm text-pos-text-muted">Sales appear here as soon as they are confirmed.</p>
          </div>
          <div className="mt-3 rounded-[10px] bg-pos-down-soft p-4 text-sm text-pos-down" role="alert">
            Could not load sales. Check the internet connection and try again.
          </div>
          <div className="mt-3 inline-flex items-center rounded-md bg-pos-warning-soft px-2 py-1 text-xs font-medium text-pos-warning">
            Void requested
          </div>
        </PosCard>
      </div>

      <PosCard title="Color tokens" className="mt-4">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {swatches.map((swatch) => (
            <li key={swatch.name} className="overflow-hidden rounded-[10px] border border-pos-border">
              <div className={`h-12 ${swatch.className}`} />
              <p className="p-2 font-mono text-xs text-pos-text-muted">{swatch.name}</p>
            </li>
          ))}
        </ul>
      </PosCard>
    </main>
  );
}
