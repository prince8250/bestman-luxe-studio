// What the New sale screen needs to know about the catalog (active only).

export interface SaleService {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface SaleStaff {
  id: string;
  name: string;
  title: string | null;
  photoUrl: string | null;
}

export interface SaleCatalog {
  categories: { id: string; name: string }[];
  services: SaleService[];
  staff: SaleStaff[];
  /** service id -> staff ids assigned to it (shown first in the staff picker). */
  serviceStaff: Record<string, string[]>;
}

// Staff assigned to the service first, then everyone else.
export function staffForService(catalog: SaleCatalog, serviceId: string | null) {
  const assigned = new Set(serviceId ? (catalog.serviceStaff[serviceId] ?? []) : []);
  return {
    assigned: catalog.staff.filter((member) => assigned.has(member.id)),
    others: catalog.staff.filter((member) => !assigned.has(member.id)),
  };
}
