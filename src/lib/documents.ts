// Pure builders for printable documents. Used by both the live backend and the offline demo backend,
// so receipts and statements always have the same shape regardless of where the data came from.
import { STATION } from "../config/station";

export interface ReceiptLine { name: string; quantity: number; unit_price: number; subtotal: number; }
export interface Receipt {
  reference: string; issued_at: string; order_created_at: string; completed_at?: string | null;
  customer_name: string; customer_phone?: string | null; fulfillment: string; address?: string | null;
  rider_name?: string | null; payment_method: string; payment_status: string; paid_at?: string | null;
  lines: ReceiptLine[]; total: number; amount_paid: number; balance: number; status: string;
  station: typeof STATION;
}

export const orderRef = (o: { id: number | string; order_reference?: string | null }) =>
  o.order_reference || `AW-${String(o.id).padStart(7, "0")}`;

export function buildReceipt(args: {
  order: any; items: any[]; inventory: any[]; payment?: any; customerName?: string | null;
  customerPhone?: string | null; riderName?: string | null;
}): Receipt {
  const { order, items, inventory, payment } = args;
  const lines: ReceiptLine[] = items.map(i => {
    const unit = Number(i.unit_price ?? inventory.find(x => x.id === i.inventory_id)?.price ?? 0);
    return {
      name: inventory.find(x => x.id === i.inventory_id)?.name || `Item #${i.inventory_id}`,
      quantity: Number(i.quantity), unit_price: unit, subtotal: unit * Number(i.quantity),
    };
  });
  const total = lines.reduce((n, l) => n + l.subtotal, 0) || Number(order.total || 0);
  const paid = (payment?.payment_status || order.payment_status) === "PAID";
  return {
    reference: orderRef(order), issued_at: new Date().toISOString(), order_created_at: order.created_at,
    completed_at: order.completed_at || null,
    customer_name: args.customerName || order.customer_name || order.walk_in_customer_name || "Walk-in customer",
    customer_phone: args.customerPhone || null, fulfillment: order.type, address: order.address || null,
    rider_name: args.riderName || null,
    payment_method: payment?.payment_method || (order.type === "Delivery" ? "Cash on Delivery" : "Cash"),
    payment_status: payment?.payment_status || order.payment_status, paid_at: payment?.paid_at || null,
    lines, total, amount_paid: paid ? total : 0, balance: paid ? 0 : total, status: order.status, station: STATION,
  };
}

export interface StatementOrder {
  reference: string; date: string; customer: string; payment_status: string; total: number; lines: ReceiptLine[];
}
export interface Statement {
  statement_no: string; company: { id: number; name: string; focal_person_name?: string; contact_information?: string | null };
  period: string; period_label: string; issued_at: string; due_date: string;
  orders: StatementOrder[]; item_summary: ReceiptLine[]; subtotal: number; amount_paid: number; amount_due: number;
  status: string; station: typeof STATION;
}

export const monthBounds = (period: string) => {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return { start: new Date(`${y}-${pad(m)}-01T00:00:00+08:00`), end: new Date(`${ny}-${pad(nm)}-01T00:00:00+08:00`), y, m };
};

export function buildStatement(args: {
  company: any; period: string; orders: any[]; itemsByOrder: Record<string, any[]>; inventory: any[];
  customerNames: Record<string, string>; payments: any[]; bill?: any | null;
}): Statement {
  const { company, period, orders, itemsByOrder, inventory, customerNames, payments, bill } = args;
  const { start, end, y, m } = monthBounds(period);
  const inMonth = orders.filter(o => {
    const t = new Date(o.completed_at || o.created_at).getTime();
    return ["DELIVERED", "PICKED UP"].includes(o.status) && t >= start.getTime() && t < end.getTime();
  }).sort((a, b) => new Date(a.completed_at || a.created_at).getTime() - new Date(b.completed_at || b.created_at).getTime());
  const rows: StatementOrder[] = inMonth.map(o => {
    const r = buildReceipt({ order: o, items: itemsByOrder[String(o.id)] || [], inventory, payment: payments.find(p => p.order_id === o.id) });
    return { reference: r.reference, date: o.completed_at || o.created_at, customer: customerNames[o.customer_id] || "Customer", payment_status: o.payment_status, total: r.total, lines: r.lines };
  });
  const summary = new Map<string, ReceiptLine>();
  rows.forEach(r => r.lines.forEach(l => {
    const key = `${l.name}@${l.unit_price}`; const cur = summary.get(key);
    if (cur) { cur.quantity += l.quantity; cur.subtotal += l.subtotal; } else summary.set(key, { ...l });
  }));
  const subtotal = rows.reduce((n, r) => n + r.total, 0);
  const paid = Number(bill?.amount_paid || 0);
  const due = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 15)).toISOString();
  return {
    statement_no: `SOA-${period.replace("-", "")}-${String(company.id).padStart(3, "0")}`,
    company: { id: company.id, name: company.name, focal_person_name: company.focal_person_name, contact_information: company.contact_information },
    period, period_label: new Date(`${period}-01T12:00:00+08:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    issued_at: new Date().toISOString(), due_date: due, orders: rows, item_summary: [...summary.values()],
    subtotal, amount_paid: paid, amount_due: Math.max(0, subtotal - paid), status: bill?.status || (subtotal === 0 ? "NO CHARGES" : "NOT YET BILLED"), station: STATION,
  };
}
