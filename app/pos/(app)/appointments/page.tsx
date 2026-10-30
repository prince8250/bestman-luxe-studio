import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Appointments" };

export default function AppointmentsPage() {
  return (
    <PlaceholderPage
      title="Appointments"
      permission="appointments.manage"
      description="Online and phone bookings, Start sale, cancel, and no-show (spec 36)."
    />
  );
}
