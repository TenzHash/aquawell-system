// Role-based access control catalogue. Administrators toggle these per role (staff / delivery).
export type PermissionKey =
  | "view_orders" | "confirm_orders" | "cancel_orders" | "walk_in_sales"
  | "view_inventory" | "adjust_inventory" | "manage_inventory"
  | "collect_payments" | "issue_receipts"
  | "view_customers" | "view_companies" | "view_live_map" | "view_customer_contact";

export interface PermissionDef { key: PermissionKey; label: string; description: string; roles: ("staff" | "delivery")[]; }

export const PERMISSIONS: PermissionDef[] = [
  { key: "view_orders", label: "View orders", description: "See the order queue and order details.", roles: ["staff"] },
  { key: "confirm_orders", label: "Confirm orders", description: "Accept pending orders and deduct stock.", roles: ["staff"] },
  { key: "cancel_orders", label: "Cancel orders", description: "Cancel orders and return stock.", roles: ["staff"] },
  { key: "walk_in_sales", label: "Record walk-in sales", description: "Create cash walk-in transactions.", roles: ["staff"] },
  { key: "view_inventory", label: "View inventory", description: "See stock levels and low-stock alerts.", roles: ["staff"] },
  { key: "adjust_inventory", label: "Adjust stock levels", description: "Add or remove stock quantities.", roles: ["staff"] },
  { key: "manage_inventory", label: "Add / edit / delete items", description: "Full inventory item management.", roles: ["staff"] },
  { key: "collect_payments", label: "Collect payments", description: "Mark an order as paid (cash or cash on delivery).", roles: ["staff", "delivery"] },
  { key: "issue_receipts", label: "Print receipts", description: "Open and print transaction receipts.", roles: ["staff", "delivery"] },
  { key: "view_customers", label: "View customer records", description: "See the customer directory.", roles: ["staff"] },
  { key: "view_companies", label: "View company billing", description: "See companies and monthly statements.", roles: ["staff"] },
  { key: "view_live_map", label: "View live delivery map", description: "See riders and delivery routes on the map.", roles: ["staff", "delivery"] },
  { key: "view_customer_contact", label: "See customer phone & address", description: "Show contact details on assigned deliveries.", roles: ["delivery"] },
];

export const DEFAULT_PERMISSIONS: Record<"staff" | "delivery", Record<string, boolean>> = {
  staff: Object.fromEntries(PERMISSIONS.filter(p => p.roles.includes("staff")).map(p => [p.key, !["manage_inventory"].includes(p.key)])),
  delivery: Object.fromEntries(PERMISSIONS.filter(p => p.roles.includes("delivery")).map(p => [p.key, !["collect_payments"].includes(p.key)])),
};

export type PermissionMap = Record<"staff" | "delivery", Record<string, boolean>>;

/** Admin always allowed; customers never; staff/rider follow the toggles (missing key => default). */
export function can(role: string, perms: PermissionMap | undefined, key: PermissionKey): boolean {
  if (role === "admin") return true;
  if (role !== "staff" && role !== "delivery") return false;
  const value = perms?.[role]?.[key];
  return value === undefined ? Boolean(DEFAULT_PERMISSIONS[role][key]) : Boolean(value);
}
