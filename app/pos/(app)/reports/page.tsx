import { redirect } from "next/navigation";

// /pos/reports opens the daily report.
export default function ReportsIndexPage() {
  redirect("/pos/reports/daily");
}
