// Offline demo backend (VITE_DATA_MODE=mock). Mirrors the behaviour of the database functions so the whole
// system can be demonstrated and tested without a hosted database. Data lives in this browser's localStorage.
import { DEFAULT_PERMISSIONS, can, type PermissionKey, type PermissionMap } from "./permissions";
import { buildReceipt, buildStatement, orderRef } from "./documents";
import { DEFAULT_STATION_PIN, type StationPin } from "../config/station";

const STORE_KEY = "aquawell-demo-store-v5";
const SESSION_KEY = "aquawell-demo-user-v1";
const PW_KEY = "aquawell-demo-passwords-v1";
export const isDemoMode = () => (import.meta as any).env?.VITE_DATA_MODE === "mock";

const day = 86400000;
const iso = (t: number) => new Date(t).toISOString();
const ago = (days: number, hour = 10) => { const d = new Date(Date.now() - days * day); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const pad7 = (n: number) => String(n).padStart(7, "0");

export const demoAccounts = [
  { email: "admin@aquawell.demo", password: "Demo123!", id: "demo-admin", full_name: "AquaWell Administrator", role: "admin" },
  { email: "staff@aquawell.demo", password: "Demo123!", id: "demo-staff", full_name: "Mika Santos", role: "staff" },
  { email: "rider@aquawell.demo", password: "Demo123!", id: "demo-rider", full_name: "Joshua Reyes", role: "delivery" },
  { email: "rider2@aquawell.demo", password: "Demo123!", id: "demo-rider2", full_name: "Paolo Dizon", role: "delivery" },
  { email: "customer@aquawell.demo", password: "Demo123!", id: "demo-customer", full_name: "Andrea Cruz", role: "customer", phone: "09171234567", address: "12 Sampaguita Street, Gogon", barangay: "Gogon", landmark: "Near the barangay hall" },
  { email: "company@aquawell.demo", password: "Demo123!", id: "demo-customer2", full_name: "Carlo Mendoza", role: "customer", phone: "09181112222", address: "Unit 4, Mendoza Hardware, Aguinaldo Hwy", barangay: "Salawag", landmark: "Beside the gas station" },
] as const;

function seed() {
  const profiles: any[] = demoAccounts.map(a => ({ id: a.id, email: a.email, full_name: a.full_name, role: a.role, phone: (a as any).phone || "", address: (a as any).address || "", barangay: (a as any).barangay || "", landmark: (a as any).landmark || "", delivery_availability: "AVAILABLE", created_at: ago(120) }));
  const inventory: any[] = [
    { id: 1, name: "Round Gallon Refill (5 gal)", category: "Refill", price: 35, stock: 180, min_stock: 40, created_at: ago(90) },
    { id: 2, name: "Slim Gallon Refill (5 gal)", category: "Refill", price: 35, stock: 22, min_stock: 40, created_at: ago(90) },
    { id: 3, name: "Empty Round Gallon", category: "Round Gallon", price: 180, stock: 30, min_stock: 10, created_at: ago(80) },
    { id: 4, name: "Empty Slim Gallon", category: "Slim Gallon", price: 190, stock: 24, min_stock: 10, created_at: ago(80) },
    { id: 5, name: "Gallon Cap (pack of 10)", category: "Caps", price: 45, stock: 60, min_stock: 20, created_at: ago(70) },
    { id: 6, name: "Tamper-Proof Seal (pack of 50)", category: "Seals", price: 60, stock: 6, min_stock: 15, created_at: ago(70) },
    { id: 7, name: "Manual Hand Pump", category: "Hardware", price: 95, stock: 14, min_stock: 5, created_at: ago(60) },
  ];
  const orders: any[] = [], orderItems: any[] = [], payments: any[] = [], sales: any[] = [];
  const store: any = { profiles, inventory, orders, orderItems, payments, sales, notifications: [], auditLogs: [], movements: [], nextId: { order: 1000, payment: 2000, sale: 3000, item: 1, move: 1, company: 3, affiliation: 3, bill: 2, notif: 1, audit: 1 } };
  const addOrder = (o: any, lines: [number, number][], opts: { method?: string; paidAt?: string | null } = {}) => {
    const id = store.nextId.order++;
    const order = { id, order_reference: `AW-${pad7(id)}`, address: o.type === "Delivery" ? o.address : "", stock_deducted: !["PENDING", "CANCELLED"].includes(o.status), ...o };
    let total = 0;
    lines.forEach(([invId, q]) => { const price = inventory.find(i => i.id === invId).price; total += price * q; orderItems.push({ id: store.nextId.item++, order_id: id, inventory_id: invId, quantity: q, unit_price: price }); });
    order.total = total; orders.push(order);
    const method = opts.method || (o.type === "Delivery" ? "Cash on Delivery" : "Cash");
    const paid = order.payment_status === "PAID";
    const pay = { payment_id: store.nextId.payment++, order_id: id, amount: total, payment_method: method, payment_status: order.payment_status, created_at: order.created_at, ...(paid ? { paid_at: opts.paidAt || order.created_at } : {}) };
    payments.push(pay);
    if (paid) {
      const customer = profiles.find(p => p.id === order.customer_id);
      sales.push({ transaction_id: store.nextId.sale++, order_id: id, customer_name: customer?.full_name || order.walk_in_customer_name || "Walk-in customer", item_name: lines.map(([i, q]) => `${inventory.find(x => x.id === i).name} × ${q}`).join(", "), quantity: lines.reduce((n, [, q]) => n + q, 0), total_amount: total, payment_method: method, date: String(pay.paid_at).slice(0, 10), created_at: pay.paid_at });
    }
    return order;
  };
  // ~120 days of paid history with a weekly rhythm, a gentle upward trend and some noise, so charts and WMA are meaningful.
  for (let d = 120; d >= 2; d--) {
    const dow = new Date(Date.now() - d * day).getDay();
    const base = dow === 0 ? 1 : dow === 6 ? 4 : 3;
    const count = Math.max(d <= 60 ? 2 : 0, Math.round(base + (120 - d) / 60 + Math.sin(d * 1.7) * 1.4));
    for (let k = 0; k < count; k++) {
      const named = (d + k) % 9 === 0; const cust = named ? ((d + k) % 2 ? "demo-customer2" : "demo-customer") : null;
      const delivery = (d + k) % 2 === 0;
      const lines: [number, number][] = [[(k + d) % 3 === 0 ? 2 : 1, 1 + ((d + k) % 4)]];
      if ((d + k) % 7 === 0) lines.push([5, 1]);
      if ((d + k) % 11 === 0) lines.push([6, 1]);
      const at = ago(d, 8 + ((k * 3 + d) % 9));
      addOrder({ customer_id: cust, walk_in_customer_name: cust ? undefined : "Walk-in customer", type: delivery ? "Delivery" : "Pickup", status: delivery ? "DELIVERED" : "PICKED UP", payment_status: "PAID", created_at: at, completed_at: at, rider_id: delivery ? (k % 2 ? "demo-rider" : "demo-rider2") : null, customer_received_at: delivery ? at : null, address: cust === "demo-customer2" ? "Unit 4, Mendoza Hardware, Aguinaldo Hwy" : "12 Sampaguita Street, Gogon" }, lines);
    }
  }
  const nowIso = new Date().toISOString();
  addOrder({ customer_id: "demo-customer2", type: "Delivery", status: "OUT FOR-DELIVERY", payment_status: "PENDING", created_at: ago(0, 8), rider_id: "demo-rider", address: "Unit 4, Mendoza Hardware, Aguinaldo Hwy", out_for_delivery_at: new Date(Date.now() - 50_000).toISOString() }, [[1, 3], [5, 1]]);
  addOrder({ customer_id: "demo-customer", type: "Delivery", status: "OUT FOR-DELIVERY", payment_status: "PENDING", created_at: ago(0, 9), rider_id: "demo-rider2", address: "12 Sampaguita Street, Gogon", out_for_delivery_at: new Date(Date.now() - 120_000).toISOString() }, [[1, 2], [2, 1]]);
  addOrder({ customer_id: "demo-customer", type: "Pickup", status: "READY FOR PICKUP", payment_status: "PENDING", created_at: ago(0, 10) }, [[1, 2]]);
  addOrder({ customer_id: "demo-customer2", type: "Delivery", status: "PENDING", payment_status: "PENDING", created_at: nowIso, address: "Unit 4, Mendoza Hardware, Aguinaldo Hwy" }, [[3, 1], [1, 2]]);
  store.companies = [
    { id: 1, name: "Mendoza Hardware & Supply", focal_person_name: "Carlo Mendoza", contact_information: "09181112222", active: true, created_at: ago(100) },
    { id: 2, name: "Dela Rosa Dental Clinic", focal_person_name: "Dr. Ana Dela Rosa", contact_information: "ana@delarosa.example", active: true, created_at: ago(90) },
  ];
  store.affiliations = [{ id: 1, customer_id: "demo-customer2", company_id: 1, affiliation_type: "Member", active: true, created_at: ago(95) }];
  store.billing = [{ id: 1, company_id: 1, billing_period: `${new Date(Date.now() - 45 * day).toISOString().slice(0, 7)}-01`, amount_due: 1260, amount_paid: 1260, status: "PAID", payment_reference: "OR-2026-0118", created_at: ago(40) }];
  store.permissions = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
  store.audit = [];
  store.station = { ...DEFAULT_STATION_PIN };
  store.riderLocations = [];
  return store;
}

/** Small built-in illustration (inline SVG) so demo products always have a viewable picture. */
export function demoProductArt(item: { name?: string; category?: string }) {
  const key = `${item.category || ""} ${item.name || ""}`.toLowerCase();
  const water = "#38bdf8", deep = "#1d4ed8", grey = "#94a3b8";
  let body: string;
  if (/cap|seal/.test(key)) body = `<rect x='70' y='95' width='100' height='70' rx='12' fill='${deep}'/><rect x='84' y='78' width='72' height='26' rx='8' fill='${water}'/><circle cx='120' cy='130' r='16' fill='white' opacity='.85'/>`;
  else if (/pump|hardware/.test(key)) body = `<rect x='100' y='40' width='40' height='24' rx='6' fill='${grey}'/><rect x='112' y='62' width='16' height='100' fill='${deep}'/><rect x='82' y='160' width='76' height='22' rx='8' fill='${water}'/><path d='M140 52 h28 v14' stroke='${grey}' stroke-width='8' fill='none' stroke-linecap='round'/>`;
  else { const slim = /slim/.test(key); const w = slim ? 78 : 104; const x = 120 - w / 2; const empty = /empty/.test(key); body = `<rect x='${120 - 16}' y='34' width='32' height='22' rx='6' fill='${deep}'/><path d='M${x + 12} 62 h${w - 24} q12 0 12 14 v84 q0 20 -20 20 h${-(w - 40)} q-20 0 -20 -20 v-84 q0 -14 12 -14z' fill='${empty ? "#e0f2fe" : water}' stroke='${deep}' stroke-width='5'/>${empty ? "" : `<path d='M${x + 8} 110 q${w / 4} -12 ${w / 2} 0 t${w / 2 - 8} 0 v50 q0 14 -14 14 h${-(w - 28)} q-14 0 -14 -14z' fill='${deep}' opacity='.35'/>`}`; }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 200'><rect width='240' height='200' fill='#f0f9ff'/>${body}</svg>`)}`;
}

let mem: any = null;
const withProductArt = (m: any) => { (m?.inventory || []).forEach((i: any) => { if (i.image_url === undefined) i.image_url = demoProductArt(i); }); return m; };
const store = (): any => {
  if (mem) return mem;
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { mem = withProductArt(JSON.parse(raw)); return mem; } } catch { /* reseed */ }
  mem = withProductArt(seed()); save(); return mem;
};
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); } catch { /* keep in memory */ } };
export function resetDemoData() { mem = withProductArt(seed()); save(); try { localStorage.removeItem(PW_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

// ---------- auth ----------
const overrides = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(PW_KEY) || "{}"); } catch { return {}; } };
export const demoCurrentUserId = () => { try { return localStorage.getItem(SESSION_KEY) || ""; } catch { return ""; } };
export function getDemoSession() { const id = demoCurrentUserId(); const p = id && store().profiles.find((x: any) => x.id === id); return p ? { user: { id: p.id, email: p.email } } : null; }
export function demoSignIn(email: string, password: string) {
  const s = store(); const profile = s.profiles.find((p: any) => p.email.toLowerCase() === email.trim().toLowerCase());
  const known = demoAccounts.find(a => a.id === profile?.id);
  const expected = profile ? (overrides()[profile.id] || (known ? known.password : overrides()[profile.id])) : undefined;
  if (!profile || !expected || expected !== password) throw new Error("Incorrect email or password.");
  localStorage.setItem(SESSION_KEY, profile.id); return { user: { id: profile.id, email: profile.email } };
}
export function demoSignUp(email: string, password: string, fullName: string) {
  const s = store(); if (s.profiles.some((p: any) => p.email.toLowerCase() === email.trim().toLowerCase())) throw new Error("An account with this email already exists.");
  const id = `demo-${Date.now()}`; s.profiles.push({ id, email: email.trim(), full_name: fullName, role: "customer", phone: "", address: "", barangay: "", landmark: "", delivery_availability: "AVAILABLE", created_at: iso(Date.now()) });
  localStorage.setItem(PW_KEY, JSON.stringify({ ...overrides(), [id]: password })); localStorage.setItem(SESSION_KEY, id); save();
  return { user: { id, email: email.trim() } };
}
export const demoSignOut = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };
export function demoChangePassword(oldPw: string, newPw: string) {
  const id = demoCurrentUserId(); const acc = demoAccounts.find(a => a.id === id); const cur = overrides()[id] || acc?.password;
  if (!id || cur !== oldPw) throw new Error("Your current password is incorrect.");
  localStorage.setItem(PW_KEY, JSON.stringify({ ...overrides(), [id]: newPw }));
}
export function demoProfile(id: string) { const p = store().profiles.find((x: any) => x.id === id); if (!p) throw new Error("We couldn't find your account. Please sign in again."); return { ...p }; }
export function demoUpdateProfile(id: string, values: any) { const p = store().profiles.find((x: any) => x.id === id); Object.assign(p, values); save(); return { ...p }; }

// ---------- helpers ----------
const me = () => { const p = store().profiles.find((x: any) => x.id === demoCurrentUserId()); if (!p) throw new Error("Please sign in to continue."); return p; };
const need = (key: PermissionKey, label: string) => { const p = me(); if (!can(p.role, store().permissions, key)) throw new Error(`Your account is not allowed to ${label}. Please ask the administrator.`); return p; };
function notify(userId: string, title: string, description: string, orderId?: number) { const s = store(); s.notifications.unshift({ id: s.nextId.notif++, user_id: userId, title, description, order_id: orderId, unread: true, created_at: iso(Date.now()) }); }
const notifyOps = (title: string, d: string, orderId?: number) => store().profiles.filter((p: any) => ["admin", "staff"].includes(p.role)).forEach((p: any) => notify(p.id, title, d, orderId));
function audit(action: string, type: string) { const s = store(); const p = s.profiles.find((x: any) => x.id === demoCurrentUserId()); s.auditLogs.unshift({ id: s.nextId.audit++, user_id: p?.id || null, user_name: p?.full_name || "System", action, log_type: type, created_at: iso(Date.now()), timestamp: iso(Date.now()) }); }
function moveStock(item: any, delta: number, reason: string) {
  const s = store(); const before = item.stock; item.stock = before + delta;
  if (item.stock < 0) { item.stock = before; throw new Error(`Not enough stock for ${item.name}.`); }
  s.movements.unshift({ id: s.nextId.move++, inventory_id: item.id, item_name: item.name, delta, stock_before: before, stock_after: item.stock, reason, actor_name: s.profiles.find((x: any) => x.id === demoCurrentUserId())?.full_name || "System", created_at: iso(Date.now()) });
  if (before > item.min_stock && item.stock <= item.min_stock) notifyOps("Low stock alert", `${item.name} is down to ${item.stock} (minimum ${item.min_stock}). Please restock soon.`);
}
const findOrder = (id: number) => { const o = store().orders.find((x: any) => x.id === id); if (!o) throw new Error("We couldn't find that order."); return o; };
const customerName = (o: any) => store().profiles.find((p: any) => p.id === o.customer_id)?.full_name || o.walk_in_customer_name || "Walk-in customer";
const companyOf = (customerId: string) => { const s = store(); const a = s.affiliations.find((x: any) => x.customer_id === customerId && x.active); return a ? s.companies.find((c: any) => c.id === a.company_id)?.name || null : null; };

// ---------- overview ----------
function wma(rowsBy: number[]) { return rowsBy[0]! * 0.5 + rowsBy[1]! * 0.3 + rowsBy[2]! * 0.2; }
function forecast(period: "daily" | "weekly" | "monthly") {
  const s = store();
  const key = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); if (period === "weekly") x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); if (period === "monthly") x.setDate(1); return x.getTime(); };
  const shift = (t: number, n: number) => { const d = new Date(t); if (period === "daily") d.setDate(d.getDate() + n); else if (period === "weekly") d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n); return key(d); };
  const newest = shift(key(new Date()), -1); const buckets = [newest, shift(newest, -1), shift(newest, -2)];
  const paid = new Set(s.orders.filter((o: any) => o.payment_status === "PAID").map((o: any) => o.id));
  return s.inventory.map((it: any) => {
    const totals = buckets.map(b => s.orderItems.filter((l: any) => l.inventory_id === it.id && paid.has(l.order_id) && key(new Date(s.orders.find((o: any) => o.id === l.order_id).created_at)) === b).reduce((n: number, l: any) => n + l.quantity, 0));
    return { inventory_id: it.id, item_name: it.name, newest_period_demand: totals[0], previous_period_demand: totals[1], oldest_period_demand: totals[2], forecast: Number(wma(totals).toFixed(2)), period: new Date(newest).toISOString().slice(0, 10) };
  });
}
export function demoOverview(profile: any): any {
  const s = store(); const role = profile.role;
  const ops = role === "admin" || role === "staff";
  const mine = ops ? s.orders : role === "delivery" ? s.orders.filter((o: any) => o.rider_id === profile.id) : s.orders.filter((o: any) => o.customer_id === profile.id);
  const orders = mine.map((o: any) => ({ ...o, customer_name: customerName(o), company_affiliation: companyOf(o.customer_id), rider_name: s.profiles.find((p: any) => p.id === o.rider_id)?.full_name || null }));
  const res: any = {
    inventory: role === "delivery" ? [] : s.inventory.map((x: any) => ({ ...x })), orders,
    payments: ops ? s.payments.map((x: any) => ({ ...x })) : s.payments.filter((p: any) => mine.some((o: any) => o.id === p.order_id)).map((x: any) => ({ ...x })),
    sales: role === "admin" ? s.sales.map((x: any) => ({ ...x })) : [],
    notifications: s.notifications.filter((n: any) => n.user_id === profile.id).slice(0, 30),
    profiles: role === "admin" ? s.profiles.map((p: any) => ({ ...p })) : [],
    riders: s.profiles.filter((p: any) => p.role === "delivery").map((p: any) => ({ staff_id: p.id, profile_id: p.id, full_name: p.full_name, availability: p.delivery_availability })),
    auditLogs: role === "admin" ? s.auditLogs.slice(0, 100) : [], forecasts: {}, permissions: s.permissions, riderLocations: demoRiderLocations(profile), station: { ...(s.station || DEFAULT_STATION_PIN) },
    customers: ops ? s.profiles.filter((p: any) => p.role === "customer").map((p: any) => ({ ...p, customer_id: p.id, company_name: companyOf(p.id) })) : undefined,
    movements: role === "admin" || can(role, s.permissions, "view_inventory") && ops ? s.movements.slice(0, 200) : [],
  };
  if (role === "admin") res.forecasts = { daily: forecast("daily"), weekly: forecast("weekly"), monthly: forecast("monthly") };
  if (role === "customer") res.customerCompanies = s.affiliations.filter((a: any) => a.customer_id === profile.id && a.active).map((a: any) => ({ name: s.companies.find((c: any) => c.id === a.company_id)?.name }));
  return res;
}

// ---------- orders ----------
export function demoCreateOrder(profile: any, p: { fulfillment: string; address?: string | undefined; items: { inventory_id: number; quantity: number }[]; dest_lat?: number | null | undefined; dest_lng?: number | null | undefined }) {
  const s = store(); if (!p.items.length) throw new Error("Add at least one item before placing your order.");
  let total = 0;
  for (const l of p.items) { const it = s.inventory.find((i: any) => i.id === l.inventory_id); if (!it) throw new Error("One of the items is no longer available."); if (it.stock < l.quantity) throw new Error(`insufficient stock for ${it.name}`); total += it.price * l.quantity; }
  const id = s.nextId.order++;
  const order = { id, order_reference: `AW-${pad7(id)}`, customer_id: profile.id, type: p.fulfillment, total, status: "PENDING", payment_status: "PENDING", created_at: iso(Date.now()), address: p.fulfillment === "Delivery" ? p.address : "", stock_deducted: false, ...(p.fulfillment === "Delivery" && p.dest_lat != null && p.dest_lng != null ? { dest_lat: p.dest_lat, dest_lng: p.dest_lng } : {}) };
  s.orders.unshift(order);
  p.items.forEach(l => s.orderItems.push({ id: s.nextId.item++, order_id: id, inventory_id: l.inventory_id, quantity: l.quantity, unit_price: s.inventory.find((i: any) => i.id === l.inventory_id).price }));
  s.payments.unshift({ payment_id: s.nextId.payment++, order_id: id, amount: total, payment_method: p.fulfillment === "Delivery" ? "Cash on Delivery" : "Cash", payment_status: "PENDING", created_at: order.created_at });
  notifyOps("New customer order", `${order.order_reference} from ${profile.full_name} is waiting for confirmation.`, id);
  notify(profile.id, "Order received", `${order.order_reference} was received and is waiting for confirmation.`, id);
  save(); return { ...order };
}
export function demoWalkIn(p: { customer_id?: string | null; walk_in_name?: string; items: { inventory_id: number; quantity: number }[] }) {
  need("walk_in_sales", "record walk-in sales"); const s = store(); let total = 0;
  if (!p.items.length) throw new Error("Add at least one item to the sale.");
  for (const l of p.items) { const it = s.inventory.find((i: any) => i.id === l.inventory_id); if (!it) throw new Error("Item not found."); if (it.stock < l.quantity) throw new Error(`Not enough stock for ${it.name}.`); total += it.price * l.quantity; }
  const id = s.nextId.order++; const at = iso(Date.now());
  const order: any = { id, order_reference: `AW-${pad7(id)}`, customer_id: p.customer_id || null, walk_in_customer_name: p.customer_id ? null : (p.walk_in_name?.trim() || "Walk-in customer"), type: "Pickup", total, status: "PICKED UP", payment_status: "PAID", created_at: at, completed_at: at, address: "", stock_deducted: true };
  s.orders.unshift(order);
  p.items.forEach(l => { const it = s.inventory.find((i: any) => i.id === l.inventory_id); moveStock(it, -l.quantity, `Walk-in sale ${order.order_reference}`); s.orderItems.push({ id: s.nextId.item++, order_id: id, inventory_id: it.id, quantity: l.quantity, unit_price: it.price }); });
  s.payments.unshift({ payment_id: s.nextId.payment++, order_id: id, amount: total, payment_method: "Cash", payment_status: "PAID", created_at: at, paid_at: at, verified_by: demoCurrentUserId() });
  recordSale(order); audit(`Recorded walk-in sale ${order.order_reference}`, "SALE"); save(); return { ...order };
}
function recordSale(order: any) {
  const s = store(); if (s.sales.some((x: any) => x.order_id === order.id)) return;
  const lines = s.orderItems.filter((l: any) => l.order_id === order.id); const pay = s.payments.find((p: any) => p.order_id === order.id);
  s.sales.unshift({ transaction_id: s.nextId.sale++, order_id: order.id, customer_name: customerName(order), item_name: lines.map((l: any) => `${s.inventory.find((i: any) => i.id === l.inventory_id)?.name} × ${l.quantity}`).join(", "), quantity: lines.reduce((n: number, l: any) => n + l.quantity, 0), total_amount: order.total, payment_method: pay?.payment_method || "Cash", date: (pay?.paid_at || iso(Date.now())).slice(0, 10), created_at: pay?.paid_at || iso(Date.now()) });
}
export function demoConfirm(id: number) {
  need("confirm_orders", "confirm orders"); const s = store(); const o = findOrder(id);
  if (o.status !== "PENDING") throw new Error("This order has already been handled.");
  const lines = s.orderItems.filter((l: any) => l.order_id === id);
  lines.forEach((l: any) => { const it = s.inventory.find((i: any) => i.id === l.inventory_id); if (it.stock < l.quantity) throw new Error(`Not enough stock for ${it.name}.`); });
  lines.forEach((l: any) => moveStock(s.inventory.find((i: any) => i.id === l.inventory_id), -l.quantity, `Order ${orderRef(o)} confirmed`));
  o.status = "CONFIRMED"; o.stock_deducted = true;
  if (o.customer_id) notify(o.customer_id, "Order confirmed", `${orderRef(o)} was confirmed and is being prepared.`, id);
  audit(`Confirmed order ${orderRef(o)}`, "ORDER"); save(); return { ...o };
}
export function demoCancel(id: number) {
  need("cancel_orders", "cancel orders"); const s = store(); const o = findOrder(id);
  if (["DELIVERED", "PICKED UP", "CANCELLED"].includes(o.status)) throw new Error("This order can no longer be cancelled.");
  if (o.stock_deducted) s.orderItems.filter((l: any) => l.order_id === id).forEach((l: any) => moveStock(s.inventory.find((i: any) => i.id === l.inventory_id), l.quantity, `Order ${orderRef(o)} cancelled`));
  o.status = "CANCELLED"; o.stock_deducted = false; o.payment_status = "CANCELLED";
  s.payments.filter((p: any) => p.order_id === id && p.payment_status !== "PAID").forEach((p: any) => { p.payment_status = "CANCELLED"; });
  if (o.customer_id) notify(o.customer_id, "Order cancelled", `${orderRef(o)} was cancelled.`, id);
  audit(`Cancelled order ${orderRef(o)}`, "ORDER"); save(); return { ...o };
}
export function demoAssign(id: number, riderId: string) {
  const o = findOrder(id); if (o.type !== "Delivery") throw new Error("Only delivery orders can have a rider.");
  o.rider_id = riderId; notify(riderId, "New delivery", `${orderRef(o)} was assigned to you.`, id); audit(`Assigned rider for ${orderRef(o)}`, "DELIVERY"); save(); return { ...o };
}
export function demoReject(id: number) { const o = findOrder(id); o.rider_id = null; audit(`Rider returned ${orderRef(o)} to the queue`, "DELIVERY"); save(); return { ...o }; }
export function demoDeliveryStatus(id: number, status: string) {
  const o = findOrder(id); o.status = status;
  if (status === "OUT FOR-DELIVERY") o.out_for_delivery_at = iso(Date.now());
  if (status === "DELIVERED") o.completed_at = iso(Date.now());
  if (o.customer_id) notify(o.customer_id, status === "DELIVERED" ? "Order delivered" : "Order on the way", `${orderRef(o)}: ${status === "DELIVERED" ? "delivered. Please confirm that you received it." : "your rider is on the way."}`, id);
  audit(`${orderRef(o)} marked ${status}`, "DELIVERY"); save(); return { ...o };
}
export function demoPickup(id: number, status: string) {
  const o = findOrder(id); o.status = status; if (status === "PICKED UP") o.completed_at = iso(Date.now());
  if (o.customer_id) notify(o.customer_id, status === "PICKED UP" ? "Order picked up" : "Ready for pickup", `${orderRef(o)}: ${status === "PICKED UP" ? "thank you for picking up your order." : "your order is ready at the station."}`, id);
  save(); return { ...o };
}
export function demoReceived(id: number) { const o = findOrder(id); o.customer_received_at = iso(Date.now()); notifyOps("Customer confirmed receipt", `${orderRef(o)} was received by the customer.`, id); save(); return { ...o }; }

// ---------- shop location & rider GPS ----------
export function demoSetPin(lat: number, lng: number) { const p = me(); p.pin_lat = lat; p.pin_lng = lng; save(); }
export function demoClearPin() {
  const p = me();
  if (store().orders.some((o: any) => o.customer_id === p.id && o.type === "Delivery" && ["PENDING", "CONFIRMED", "OUT FOR-DELIVERY"].includes(o.status))) throw new Error("You have an active delivery. You can remove your pin once it is completed.");
  p.pin_lat = null; p.pin_lng = null; save();
}
export function demoStation(): StationPin { return { ...(store().station || DEFAULT_STATION_PIN) }; }
export function demoSetStation(lat: number, lng: number, label: string | null): StationPin {
  const p = me(); if (!["admin", "staff"].includes(p.role)) throw new Error("Only the owner or staff can pin the shop location.");
  const s = store(); s.station = { lat, lng, label: label?.trim() || null, updated_at: iso(Date.now()), pinned: true };
  audit(`Pinned the shop location at ${lat.toFixed(5)}, ${lng.toFixed(5)}`, "SETTINGS"); save(); return { ...s.station };
}
export function demoShareLocation(lat: number, lng: number) {
  const p = me(); if (p.role !== "delivery") return; const s = store(); s.riderLocations ||= [];
  const row = s.riderLocations.find((r: any) => r.rider_id === p.id);
  if (row) Object.assign(row, { lat, lng, updated_at: iso(Date.now()) }); else s.riderLocations.push({ rider_id: p.id, lat, lng, updated_at: iso(Date.now()) });
  save();
}
/** Staff/admin see every rider; a rider sees themself; a customer sees only the rider of an order that is out for delivery. */
export function demoRiderLocations(profile?: any): any[] {
  const s = store(); const p = profile || (demoCurrentUserId() ? s.profiles.find((x: any) => x.id === demoCurrentUserId()) : null); if (!p) return [];
  const all: any[] = (s.riderLocations || []).map((r: any) => ({ ...r }));
  if (p.role === "admin" || p.role === "staff") return all;
  if (p.role === "delivery") return all.filter(r => r.rider_id === p.id);
  return all.filter(r => s.orders.some((o: any) => o.customer_id === p.id && o.rider_id === r.rider_id && o.status === "OUT FOR-DELIVERY"));
}
export function demoSetAvailability(v: string) { const p = me(); p.delivery_availability = v; save(); return v; }

/** Per-order payment: marks this one order's payment as received (cash at pickup or cash on delivery). */
export function demoMarkOrderPaid(orderId: number) {
  need("collect_payments", "collect payments"); const s = store(); const o = findOrder(orderId);
  if (["PENDING", "CANCELLED"].includes(o.status)) throw new Error("This order must be confirmed before payment can be collected.");
  if (o.payment_status === "PAID") throw new Error("This order is already paid.");
  const pay = s.payments.find((p: any) => p.order_id === orderId && ["PENDING", "UNPAID"].includes(p.payment_status));
  if (!pay) throw new Error("No open payment was found for this order.");
  pay.payment_status = "PAID"; pay.paid_at = iso(Date.now()); pay.verified_by = demoCurrentUserId(); pay.payment_method = o.type === "Delivery" ? "Cash on Delivery" : "Cash";
  o.payment_status = "PAID"; recordSale(o);
  if (o.customer_id) notify(o.customer_id, "Payment received", `Payment for ${orderRef(o)} was received. Thank you!`, orderId);
  audit(`Collected payment for ${orderRef(o)}`, "PAYMENT"); save(); return { ...o };
}

export function demoOrderItems(orderIds: number[]) { const s = store(); return s.orderItems.filter((l: any) => orderIds.includes(l.order_id)).map((l: any) => ({ ...l, item_name: s.inventory.find((i: any) => i.id === l.inventory_id)?.name })); }
export function demoReceipt(orderId: number) {
  const s = store(); const o = findOrder(orderId); const p = me();
  if (p.role === "customer" && o.customer_id !== p.id) throw new Error("You can only view your own receipts.");
  if (p.role !== "customer") need("issue_receipts", "print receipts");
  const cust = s.profiles.find((x: any) => x.id === o.customer_id);
  return buildReceipt({ order: o, items: s.orderItems.filter((l: any) => l.order_id === orderId), inventory: s.inventory, payment: s.payments.find((x: any) => x.order_id === orderId), customerName: customerName(o), customerPhone: cust?.phone, riderName: s.profiles.find((x: any) => x.id === o.rider_id)?.full_name });
}

// ---------- inventory CRUD ----------
const validItem = (v: any) => {
  if (!String(v.name || "").trim()) throw new Error("Item name is required.");
  if (!(Number(v.price) >= 0)) throw new Error("Price must be zero or more.");
  if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0) throw new Error("Stock must be a whole number, zero or more.");
  if (!Number.isInteger(Number(v.min_stock)) || Number(v.min_stock) < 0) throw new Error("Low-stock level must be a whole number, zero or more.");
};
export function demoCreateItem(v: any) {
  need("manage_inventory", "add inventory items"); validItem(v); const s = store();
  if (s.inventory.some((i: any) => i.name.toLowerCase() === v.name.trim().toLowerCase())) throw new Error("An item with this name already exists.");
  const id = Math.max(0, ...s.inventory.map((i: any) => i.id)) + 1;
  const item = { id, name: v.name.trim(), category: v.category, price: Number(v.price), stock: 0, min_stock: Number(v.min_stock), created_at: iso(Date.now()) };
  s.inventory.push(item); if (Number(v.stock) > 0) moveStock(item, Number(v.stock), "Opening stock");
  audit(`Added inventory item ${item.name}`, "INVENTORY"); save(); return { ...item };
}
export function demoUpdateItem(id: number, v: any) {
  need("manage_inventory", "edit inventory items"); validItem(v); const s = store(); const it = s.inventory.find((i: any) => i.id === id); if (!it) throw new Error("Item not found.");
  if (s.inventory.some((i: any) => i.id !== id && i.name.toLowerCase() === v.name.trim().toLowerCase())) throw new Error("An item with this name already exists.");
  Object.assign(it, { name: v.name.trim(), category: v.category, price: Number(v.price), min_stock: Number(v.min_stock) });
  if (Number(v.stock) !== it.stock) moveStock(it, Number(v.stock) - it.stock, "Manual stock correction");
  audit(`Updated inventory item ${it.name}`, "INVENTORY"); save(); return { ...it };
}
export function demoSetImage(id: number, url: string | null) {
  need("manage_inventory", "change product photos"); const s = store(); const it = s.inventory.find((i: any) => i.id === id); if (!it) throw new Error("Item not found.");
  it.image_url = url; audit(`${url ? "Updated" : "Removed"} image of ${it.name}`, "INVENTORY"); save(); return true;
}
export function demoDeleteItem(id: number) {
  need("manage_inventory", "delete inventory items"); const s = store(); const it = s.inventory.find((i: any) => i.id === id); if (!it) throw new Error("Item not found.");
  if (s.orderItems.some((l: any) => l.inventory_id === id)) throw new Error(`${it.name} has order history and can't be deleted. Set its stock to zero instead to stop selling it.`);
  s.inventory = s.inventory.filter((i: any) => i.id !== id); audit(`Deleted inventory item ${it.name}`, "INVENTORY"); save(); return true;
}
export function demoAdjust(id: number, delta: number) { need("adjust_inventory", "adjust stock"); const it = store().inventory.find((i: any) => i.id === id); if (!it) throw new Error("Item not found."); moveStock(it, delta, delta > 0 ? "Stock received" : "Stock removed"); audit(`Adjusted stock of ${it.name} by ${delta}`, "INVENTORY"); save(); return { ...it }; }

// ---------- admin ----------
export function demoUpdateRole(userId: string, role: string) { const p = store().profiles.find((x: any) => x.id === userId); if (!p) throw new Error("Account not found."); if (p.id === demoCurrentUserId()) throw new Error("You can't change your own role."); p.role = role; audit(`Changed ${p.full_name} to ${role}`, "ACCOUNT"); save(); }
export function demoMarkNotificationsRead() { const id = demoCurrentUserId(); store().notifications.forEach((n: any) => { if (n.user_id === id) n.unread = false; }); save(); }
export function demoSetPermission(role: "staff" | "delivery", key: string, value: boolean) {
  if (me().role !== "admin") throw new Error("Only the administrator can change permissions."); const s = store(); s.permissions[role][key] = value;
  audit(`${value ? "Allowed" : "Blocked"} "${key}" for ${role === "staff" ? "station staff" : "delivery riders"}`, "ACCESS"); save();
}
export const demoPermissions = (): PermissionMap => store().permissions;

// ---------- account deletion ----------
export function demoExportMyData() {
  const s = store(); const p = me(); const orders = s.orders.filter((o: any) => o.customer_id === p.id);
  return { exported_at: iso(Date.now()), profile: { full_name: p.full_name, email: p.email, phone: p.phone, address: p.address, barangay: p.barangay, landmark: p.landmark, created_at: p.created_at }, orders: orders.map((o: any) => ({ reference: orderRef(o), date: o.created_at, type: o.type, status: o.status, payment_status: o.payment_status, total: o.total, items: s.orderItems.filter((l: any) => l.order_id === o.id).map((l: any) => ({ name: s.inventory.find((i: any) => i.id === l.inventory_id)?.name, quantity: l.quantity, unit_price: l.unit_price })) })), notifications: s.notifications.filter((n: any) => n.user_id === p.id).map((n: any) => ({ title: n.title, description: n.description, created_at: n.created_at })) };
}
export function demoDeleteAccount(password: string) {
  const s = store(); const p = me(); if (p.role !== "customer") throw new Error("Only customer accounts can be deleted here. Please contact the administrator.");
  const acc = demoAccounts.find(a => a.id === p.id); if ((overrides()[p.id] || acc?.password) !== password) throw new Error("That password is incorrect.");
  if (s.orders.some((o: any) => o.customer_id === p.id && !["DELIVERED", "PICKED UP", "CANCELLED"].includes(o.status))) throw new Error("You still have an active order. Please wait until it is completed or cancel it before deleting your account.");
  // Order, payment and sales records are kept for the station's accounting, but disconnected from the person.
  s.orders.filter((o: any) => o.customer_id === p.id).forEach((o: any) => { o.customer_id = null; o.walk_in_customer_name = "Deleted customer"; o.address = ""; });
  s.sales.forEach((x: any) => { if (s.orders.find((o: any) => o.id === x.order_id)?.walk_in_customer_name === "Deleted customer") x.customer_name = "Deleted customer"; });
  s.notifications = s.notifications.filter((n: any) => n.user_id !== p.id); s.affiliations = s.affiliations.filter((a: any) => a.customer_id !== p.id);
  s.profiles = s.profiles.filter((x: any) => x.id !== p.id); audit("A customer deleted their account", "ACCOUNT");
  const o = overrides(); delete o[p.id]; localStorage.setItem(PW_KEY, JSON.stringify(o)); demoSignOut(); save();
}

// ---------- companies & statements ----------
export function demoCompanyData() {
  const s = store(); need("view_companies", "view companies");
  return { companies: s.companies.map((c: any) => ({ ...c })), customers: s.profiles.filter((p: any) => p.role === "customer").map((p: any) => ({ id: p.id, full_name: p.full_name, email: p.email })),
    affiliations: s.affiliations.map((a: any) => ({ ...a, profiles: s.profiles.find((p: any) => p.id === a.customer_id), companies: s.companies.find((c: any) => c.id === a.company_id) })),
    bills: s.billing.map((b: any) => ({ ...b, companies: s.companies.find((c: any) => c.id === b.company_id) })) };
}
export function demoCreateCompany(v: any) { const s = store(); if (s.companies.some((c: any) => c.name.toLowerCase() === v.name.toLowerCase())) throw new Error("A company with this name already exists."); s.companies.push({ id: s.nextId.company++, ...v, active: true, created_at: iso(Date.now()) }); save(); }
export function demoAddAffiliation(customerId: string, companyId: number) { const s = store(); if (s.affiliations.some((a: any) => a.customer_id === customerId && a.active)) throw new Error("This customer is already assigned to a company."); s.affiliations.push({ id: s.nextId.affiliation++, customer_id: customerId, company_id: companyId, affiliation_type: "Member", active: true, created_at: iso(Date.now()) }); save(); }
export function demoCompanyOrdersFor(companyId: number) {
  const s = store(); const ids = s.affiliations.filter((a: any) => a.company_id === companyId && a.active).map((a: any) => a.customer_id);
  const orders = s.orders.filter((o: any) => ids.includes(o.customer_id));
  const itemsByOrder: Record<string, any[]> = {}; s.orderItems.forEach((l: any) => { if (orders.some((o: any) => o.id === l.order_id)) (itemsByOrder[l.order_id] ||= []).push(l); });
  return { company: s.companies.find((c: any) => c.id === companyId), orders, itemsByOrder, inventory: s.inventory, payments: s.payments, customerNames: Object.fromEntries(s.profiles.map((p: any) => [p.id, p.full_name])), bill: s.billing.find((b: any) => b.company_id === companyId) };
}
export function demoStatement(companyId: number, period: string) {
  const d = demoCompanyOrdersFor(companyId); const bill = store().billing.find((b: any) => b.company_id === companyId && String(b.billing_period).slice(0, 7) === period);
  return buildStatement({ ...d, period, bill });
}
export function demoSaveBill(companyId: number, period: string) {
  const s = store(); const st = demoStatement(companyId, period); const existing = s.billing.find((b: any) => b.company_id === companyId && String(b.billing_period).slice(0, 7) === period);
  if (existing) { if (existing.status === "VOID") throw new Error("This bill was voided."); existing.amount_due = st.subtotal; existing.status = existing.amount_paid >= st.subtotal ? "PAID" : existing.amount_paid > 0 ? "PARTIALLY_PAID" : "UNPAID"; }
  else s.billing.push({ id: s.nextId.bill++, company_id: companyId, billing_period: `${period}-01`, amount_due: st.subtotal, amount_paid: 0, status: st.subtotal === 0 ? "PAID" : "UNPAID", created_at: iso(Date.now()) });
  audit(`Saved ${period} statement for ${st.company.name}`, "BILLING"); save();
}
export function demoMarkBillPaid(billId: number, ref: string | null) { const b = store().billing.find((x: any) => x.id === billId); b.amount_paid = b.amount_due; b.status = "PAID"; b.payment_reference = ref; save(); }
