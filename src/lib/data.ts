import { requireSupabase } from './supabase';
import * as demo from './demo';
import { isDemoMode } from './demo';
import { buildReceipt, buildStatement, type Receipt, type Statement } from './documents';
import { DEFAULT_PERMISSIONS, type PermissionMap } from './permissions';
import { DEFAULT_STATION_PIN, type StationPin } from '../config/station';

export { isDemoMode };

/** Turns raw database / network errors into short, customer-friendly sentences. Details go to the console only. */
export function friendlyError(e: any, fallback = 'Something went wrong. Please try again.'): string {
  const raw = String(e?.message || e || '');
  if (!raw) return fallback;
  if (/insufficient stock/i.test(raw)) return raw.replace(/^.*insufficient stock for/i, 'Not enough stock for');
  if (/row-level security|permission denied|not authorized|not allowed|42501/i.test(raw)) return 'Your account is not allowed to do this. Please ask the administrator.';
  if (/Failed to fetch|NetworkError|network request failed/i.test(raw)) return 'We couldn\u2019t reach the server. Please check your internet connection and try again.';
  if (/invalid login credentials/i.test(raw)) return 'Incorrect email or password.';
  if (/already registered|already exists|duplicate key/i.test(raw)) return 'That record already exists.';
  if (/violates foreign key|referenced from table|is still referenced/i.test(raw)) return 'This record is in use and can\u2019t be removed.';
  if (/violates check constraint/i.test(raw)) return 'One of the values you entered is not allowed. Please review and try again.';
  if (/JWT|session|auth/i.test(raw) && /expired|invalid|missing/i.test(raw)) return 'Your session has expired. Please sign in again.';
  if (/schema cache|function public\.|relation .* does not exist|could not find the function|PGRST/i.test(raw)) { console.error('[AquaWell] backend feature unavailable:', raw); return 'This feature is not available right now. Please contact the station.'; }
  return raw.length > 180 ? fallback : raw;
}

// --- Type Definitions ---
export interface Profile {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  barangay?: string;
  landmark?: string;
  role: string;
  created_at?: string;
  delivery_availability?: string;
  company_affiliation?: string;
  /** Customer's saved delivery pin on the map. */
  pin_lat?: number | null;
  pin_lng?: number | null;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  min_stock: number;
  image_url?: string | null;
  created_at?: string;
}

export interface Order {
  id: number;
  type: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  customer_id?: string;
  address?: string;
  rider_id?: string | null;
  order_reference?: string;
  customer_received_at?: string | null;
  archived?: boolean;
  completed_at?: string | null;
  out_for_delivery_at?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  /** Backend stock deduction should be enforced by an atomic Supabase RPC. */
  stock_deducted?: boolean;
}

export interface Payment {
  payment_id: number;
  order_id: number;
  amount: number;
  payment_method: string;
  payment_status: string;
  receipt_url?: string;
  paid_at?: string;
  created_at: string;
}

export interface Staff {
  staff_id: number | string;
  profile_id: string;
  full_name?: string;
  availability?: string;
  role?: string;
}

export interface Sale {
  transaction_id: number;
  customer_name: string;
  item_name: string;
  quantity: number;
  total_amount: number;
  payment_method: string;
  date: string;
  created_at: string;
  order_id: number;
}

export interface AuditLog {
  id: number;
  user_name: string;
  action: string;
  log_type: string;
  timestamp: string;
  created_at: string;
  user_id: string;
}

export interface NotificationMsg {
  id: number;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  created_at: string;
  user_id?: string;
  order_id?: number;
}

export interface OverviewResult {
  inventory: InventoryItem[];
  orders: Order[];
  payments: Payment[];
  sales: Sale[];
  notifications: NotificationMsg[];
  profiles: Profile[];
  riders: Staff[];
  auditLogs: AuditLog[];
  forecasts: Record<string, any[]>;
  customerCompanies?: { name: string; affiliation_type?: string }[];
  /** Registered customers (staff/admin) used by the walk-in order form and the Customers page. */
  customers?: any[];
  forecastError?: string;
  permissions?: PermissionMap;
  movements?: any[];
  riderLocations?: any[];
  /** Where the shop is pinned on the map (falls back to the default position until the owner/staff pins it). */
  station?: StationPin;
}

export interface CustomerOrderPayload {
  fulfillment: string;
  address?: string;
  items: { inventory_id: number; quantity: number }[];
  /** Where on the map the delivery goes (optional). */
  dest_lat?: number | null | undefined;
  dest_lng?: number | null | undefined;
}

// --- Functions ---

export function normalizeRole(value: unknown): Profile["role"] {
  const role = String(value || "").trim().toLowerCase();
  if (!["admin", "staff", "delivery", "customer"].includes(role)) {
    throw new Error("Unsupported account role: " + String(value || "(empty)"));
  }
  return role as Profile["role"];
}

export function canAccessPage(roleValue: unknown, page: string, perms?: PermissionMap): boolean {
  let role: string;
  try { role = normalizeRole(roleValue); } catch { return false; }
  const pages: Record<string, string[]> = {
    admin: ["Overview", "Notifications", "Orders", "Live Map", "Rider Status", "Shop Location", "Companies", "Inventory", "Sales & Forecasts", "People & Roles", "Access Control", "Audit Log", "Account"],
    staff: ["Overview", "Notifications", "Orders", "Live Map", "Rider Status", "Shop Location", "Customers", "Companies", "Inventory", "Account"],
    delivery: ["Overview", "Notifications", "My Deliveries", "Live Map", "Account"],
    customer: ["Overview", "Notifications", "Order Water", "My Orders", "Account"],
  };
  if (!(pages[role] || []).includes(page)) return false;
  const gate: Record<string, string> = { Orders: "view_orders", "Live Map": "view_live_map", Customers: "view_customers", Companies: "view_companies", Inventory: "view_inventory" };
  const key = gate[page];
  if (key && (role === "staff" || role === "delivery")) {
    const v = (perms || DEFAULT_PERMISSIONS)[role]?.[key];
    return v === undefined ? Boolean((DEFAULT_PERMISSIONS as any)[role][key] ?? true) : Boolean(v);
  }
  return true;
}

export async function updateOwnProfile(values: { full_name: string; phone: string | null; address: string | null; barangay: string | null; landmark: string | null }): Promise<Profile> {
  if (isDemoMode()) return demo.demoUpdateProfile(demo.demoCurrentUserId(), values) as Profile;
  const db = requireSupabase();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error("You must be signed in to update your profile.");
  const { data, error } = await db.from("profiles").update(values).eq("id", userId)
    .select("id,full_name,email,phone,address,barangay,landmark,role,delivery_availability,created_at,pin_lat,pin_lng").single();
  if (error) throw error;
  return { ...data, role: normalizeRole(data.role) };
}

export async function getCurrentProfile(userId: string): Promise<Profile> {
  if (isDemoMode()) return demo.demoProfile(userId) as Profile;
  const db = requireSupabase();
  const { data, error } = await db
    .from('profiles')
    .select('id,full_name,email,phone,address,barangay,landmark,role,delivery_availability,created_at,pin_lat,pin_lng')
    .eq('id', userId)
    .maybeSingle();
    
  if (error) throw error;
  if (!data) throw new Error('We couldn\u2019t find your account details. Please contact the station administrator.');
  
  const role = normalizeRole(data.role);
  return { ...data, role };
}

function workflowPriority(order: Order, role: string): number {
  const status = String(order.status || '').toUpperCase();
  if (role === 'customer') {
    if (status === 'PENDING') return 0;
    if (status === 'CONFIRMED') return 1;
    if (status === 'OUT FOR-DELIVERY') return 2;
    if (status === 'DELIVERED' && !order.customer_received_at) return 3;
    if (status === 'READY FOR PICKUP') return 4;
    if (status === 'DELIVERED' || status === 'PICKED UP') return 5;
    return 6;
  }
  if (role === 'delivery') {
    if (status === 'OUT FOR-DELIVERY') return 0;
    if (status === 'CONFIRMED') return 1;
    if (status === 'DELIVERED' && !order.customer_received_at) return 2;
    return 3;
  }
  if (status === 'PENDING') return 0;
  if (status === 'CONFIRMED') return 1;
  if (status === 'OUT FOR-DELIVERY') return 2;
  if (status === 'DELIVERED' && !order.customer_received_at) return 3;
  if (status === 'READY FOR PICKUP') return 4;
  if (status === 'DELIVERED' || status === 'PICKED UP') return 5;
  return 6;
}

function sortOrders(orders: Order[], role: string) {
  orders.sort((a, b) => workflowPriority(a, role) - workflowPriority(b, role)
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    || String(a.order_reference || a.id).localeCompare(String(b.order_reference || b.id)));
}

/**
 * `orders` has no customer-name / company columns, so the UI used to fall back to
 * "Walk-in customer" for every order. Resolve them here: first through the
 * get_order_customer_info() RPC (works for staff, admin and riders), then - for
 * staff/admin only - through direct profile + affiliation lookups.
 */
async function attachCustomerInfo(db: any, orders: any[], role: string) {
  if (!orders.length) return orders;
  const ids = orders.map(o => o.id);
  const byOrder = new Map<number, { customer_name?: string | undefined; company_name?: string | null | undefined }>();
  const { data, error } = await db.rpc('get_order_customer_info', { p_order_ids: ids });
  if (!error && Array.isArray(data)) {
    data.forEach((r: any) => byOrder.set(r.order_id, { customer_name: r.customer_name, company_name: r.company_name }));
  } else if (['admin', 'staff'].includes(role)) {
    console.warn('get_order_customer_info is unavailable; falling back to direct lookups.', error?.message);
    const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
    if (customerIds.length) {
      const [{ data: people }, { data: affiliations }] = await Promise.all([
        db.from('profiles').select('id,full_name,email').in('id', customerIds),
        db.from('customer_company_affiliations').select('customer_id,companies!customer_company_affiliations_company_id_fkey(name)').in('customer_id', customerIds).eq('active', true),
      ]);
      const names = new Map((people || []).map((p: any) => [p.id, p.full_name || p.email]));
      const companies = new Map<string, string[]>();
      (affiliations || []).forEach((a: any) => { const n = a.companies?.name; if (n) companies.set(a.customer_id, [...(companies.get(a.customer_id) || []), n]); });
      orders.forEach(o => byOrder.set(o.id, { customer_name: o.customer_id ? names.get(o.customer_id) as string : undefined, company_name: o.customer_id ? (companies.get(o.customer_id) || []).join(', ') || null : null }));
    }
  }
  return orders.map(o => {
    const info = byOrder.get(o.id);
    return {
      ...o,
      customer_name: info?.customer_name || o.walk_in_customer_name || 'Walk-in customer',
      company_affiliation: info?.company_name || null,
    };
  });
}

export async function loadOverview(profile: Profile): Promise<OverviewResult> {
  if (isDemoMode()) { const r = demo.demoOverview(profile) as OverviewResult; sortOrders(r.orders, profile.role); return r; }
  const db = requireSupabase();
  const role = profile.role;
  
  const result: OverviewResult = { 
    inventory: [], orders: [], payments: [], sales: [], notifications: [], profiles: [], riders: [], auditLogs: [], forecasts: {} 
  };

  if (['admin','staff'].includes(role)) {
    const [inventory, orders, payments, staffProfiles] = await Promise.all([
      db.from('inventory').select('*').order('name'),
      db.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('payments').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('profiles').select('id, full_name, role, delivery_availability').eq('role', 'delivery')
    ]);
    
    if (inventory.error) throw inventory.error;
    if (orders.error) throw orders.error;
    if (payments.error) throw payments.error;
    
    // Registered customers for the walk-in form and the Customers page (staff and admin may read profiles).
    const [customerRows, affiliationRows] = await Promise.all([
      db.from('profiles').select('id, full_name, email, phone, address').eq('role', 'customer').order('full_name'),
      db.from('customer_company_affiliations').select('customer_id, companies!customer_company_affiliations_company_id_fkey(name)').eq('active', true),
    ]);
    if (customerRows.error) throw new Error(friendlyError(customerRows.error, 'We couldn\u2019t load the customer list.'));
    const companyByCustomer = new Map<string, string[]>();
    (affiliationRows.data || []).forEach((a: any) => { const n = a.companies?.name; if (n) companyByCustomer.set(a.customer_id, [...(companyByCustomer.get(a.customer_id) || []), n]); });
    result.customers = (customerRows.data || []).map((c: any) => ({ ...c, customer_id: c.id, company_name: (companyByCustomer.get(c.id) || []).join(', ') || null }));

    Object.assign(result, { 
      inventory: inventory.data || [], 
      orders: await attachCustomerInfo(db, orders.data || [], role), 
      payments: payments.data || [], 
      riders: (staffProfiles.data || []).map(p => ({ staff_id: p.id, profile_id: p.id, full_name: p.full_name, availability: p.delivery_availability || 'AVAILABLE', role: p.role })) 
    });
  } else if (role === 'delivery') {
    const { data, error } = await db.from('orders').select('*').eq('rider_id', profile.id).order('created_at', { ascending: false });
    if(error) throw error; 
    result.orders = await attachCustomerInfo(db, (data as Order[]) || [], role);
  } else {
    const { data, error } = await db.from('orders').select('*').eq('customer_id', profile.id).order('created_at', { ascending: false });
    if(error) throw error;
    const customerOrders = (data as Order[]) || [];
    const riderIds = [...new Set(customerOrders.map(o => o.rider_id).filter((id): id is string => Boolean(id)))];
    if (riderIds.length) {
      const { data: riderProfiles } = await db.rpc('get_delivery_rider_names', { p_rider_ids: riderIds });
      const riderNames = new Map((riderProfiles || []).map((r: any) => [r.id, r.full_name]));
      result.orders = customerOrders.map(o => ({ ...o, rider_name: riderNames.get(o.rider_id || '') || null } as any));
    } else result.orders = customerOrders;
    
    const { data: customerAffiliations } = await db.from('customer_company_affiliations').select('affiliation_type,companies!customer_company_affiliations_company_id_fkey(name)').eq('customer_id', profile.id).eq('active', true);
    result.customerCompanies = (customerAffiliations || []).map((a: any) => ({ name: a.companies?.name || 'Company', affiliation_type: a.affiliation_type }));
    const { data: payments, error: payError } = await db.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
    if(!payError) result.payments = (payments as Payment[]) || []; 
    
    const { data: inventory, error: invError } = await db.from('inventory').select('*').order('name');
    if(invError) throw invError; 
    result.inventory = (inventory as InventoryItem[]) || [];
  }

  if (role === 'admin') {
    const [sales, profiles, auditLogs] = await Promise.all([
      db.from('sales').select('*').order('created_at',{ ascending: false }).limit(250),
      db.from('profiles').select('*').order('created_at',{ ascending: false }).limit(200),
      db.from('audit_logs').select('*').order('created_at',{ ascending: false }).limit(100)
    ]);
    
    if(sales.error) throw sales.error; 
    if(profiles.error) throw profiles.error; 
    if(auditLogs.error) throw auditLogs.error;
    Object.assign(result, { sales: sales.data || [], profiles: profiles.data || [], auditLogs: auditLogs.data || [] });

    const periods = ['daily', 'weekly', 'monthly'] as const;
    const forecastResults = await Promise.all(periods.map(period => db.rpc('get_wma_forecast', { p_period: period })));
    result.forecasts = {};
    periods.forEach((period, index) => { result.forecasts[period] = forecastResults[index]?.data || []; });
    const failed = forecastResults.find(r => r.error);
    if (failed?.error) {
      console.error('Forecast error:', failed.error);
      result.forecastError = 'Demand forecasts are temporarily unavailable.';
    }
  }

  // Optional extras: older databases without these tables still work.
  try {
    const { data: rp } = await db.from('role_permissions').select('role,permission,enabled');
    const map: PermissionMap = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
    (rp || []).forEach((r: any) => { if (map[r.role as 'staff' | 'delivery']) map[r.role as 'staff' | 'delivery'][r.permission] = Boolean(r.enabled); });
    result.permissions = map;
  } catch { result.permissions = DEFAULT_PERMISSIONS as PermissionMap; }
  if (['admin', 'staff'].includes(role)) {
    try { const { data: mv } = await db.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(200); result.movements = mv || []; } catch { result.movements = []; }
  }
  result.riderLocations = await loadRiderLocations();
  result.station = await loadStationLocation();
  const { data: notifications, error: notificationError } = await db.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20);
  if (notificationError) throw new Error(friendlyError(notificationError, 'We couldn\u2019t load your notifications.'));
  result.notifications = (notifications as NotificationMsg[]) || [];
  // Workflow priority is the primary display criterion; timestamp is only a tie-breaker.
  sortOrders(result.orders, role);
  
  return result;
}

export async function createCustomerOrder({ fulfillment, address, items, dest_lat, dest_lng }: CustomerOrderPayload) {
  if (isDemoMode()) return demo.demoCreateOrder(await currentDemoProfile(), { fulfillment, address, items, dest_lat, dest_lng }) as unknown as Order;
  const db = requireSupabase();
  const { data: userData, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!userData.user) throw new Error("Must be logged in to order.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Add at least one item before placing your order.");
  }
  if (fulfillment !== 'Delivery' && fulfillment !== 'Pickup') {
    throw new Error("Choose a valid delivery or pickup option.");
  }
  if (fulfillment === 'Delivery' && !String(address || '').trim()) {
    throw new Error("A delivery address is required.");
  }

  // Create the order, order items, and pending payment atomically through the
  // SECURITY DEFINER RPC. Do not insert directly into orders/order_items/payments:
  // the database validates prices and quantities and leaves stock unchanged
  // until staff calls confirm_order_and_deduct_stock.
  const { data: order, error } = await db.rpc('place_customer_order', {
    p_type: fulfillment,
    p_address: address?.trim() || null,
    p_items: items.map(({ inventory_id, quantity }) => ({ inventory_id, quantity })),
    // Pickup is paid in cash at the station; delivery is paid on arrival.
    p_payment_method: fulfillment === 'Pickup' ? 'Cash' : 'Cash on Delivery',
    p_dest_lat: fulfillment === 'Delivery' ? (dest_lat ?? null) : null,
    p_dest_lng: fulfillment === 'Delivery' ? (dest_lng ?? null) : null,
  });

  if (error) throw error;
  if (!order) throw new Error("We couldn\u2019t confirm your order was placed. Please check My Orders before trying again.");
  return order as Order;
}


export async function confirmOrder(orderId: number) {
  if (isDemoMode()) return demo.demoConfirm(orderId) as unknown as Order;
  const { data, error } = await requireSupabase().rpc(
    'confirm_order_and_deduct_stock',
    { p_order_id: orderId }
  );

  if (error) {
    throw new Error(
      friendlyError(error, 'We couldn\u2019t confirm this order. Please try again.')
    );
  }

  if (!data) {
    throw new Error(
      'The order could not be confirmed. Please refresh and try again.'
    );
  }

  return data as Order;
}


export async function cancelOrder(orderId: number) {
  if (isDemoMode()) return demo.demoCancel(orderId);
  // Cancellation must be one database transaction: separate browser updates can
  // leave an order cancelled while stock is still deducted (or restore it twice).
  const { data, error } = await requireSupabase().rpc('cancel_order_and_restore_stock', {
    p_order_id: orderId,
  });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t cancel this order.'));
  return data;
}

export async function updateDeliveryStatus(orderId: number, status: string) {
  if (isDemoMode()) return demo.demoDeliveryStatus(orderId, status);
  if (!['OUT FOR-DELIVERY', 'DELIVERED'].includes(status)) throw new Error('Unsupported delivery status.');
  const { data, error } = await requireSupabase().rpc('update_assigned_delivery_status', { p_order_id: orderId, p_status: status });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t update the delivery status.'));
  return data;
}

export async function confirmCustomerReceipt(orderId: number) {
  if (isDemoMode()) return demo.demoReceived(orderId);
  const db = requireSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('You must be signed in.');
  const { data, error } = await db.rpc('confirm_customer_order_receipt', { p_order_id: orderId });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t confirm receipt.'));
  return data;
}

export async function updateRiderAvailability(availability: 'AVAILABLE' | 'UNAVAILABLE') {
  if (isDemoMode()) return demo.demoSetAvailability(availability);
  const { data, error } = await requireSupabase().rpc('set_delivery_availability', { p_availability: availability });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t update availability.'));
  return data;
}

export async function updatePickupStatus(orderId: number, status: string) {
  if (isDemoMode()) return demo.demoPickup(orderId, status);
  if (!['READY FOR PICKUP', 'PICKED UP'].includes(status)) throw new Error('Unsupported pickup status.');
  // Clients have no direct UPDATE on orders; the status change goes through an RPC.
  const { data, error } = await requireSupabase().rpc('update_pickup_status', { p_order_id: orderId, p_status: status });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t update the pickup status.'));
  return data;
}

export async function rejectDeliveryAssignment(orderId: number) {
  if (isDemoMode()) return demo.demoReject(orderId);
  const { data, error } = await requireSupabase().rpc('reject_delivery_assignment', { p_order_id: orderId });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t update this assignment.'));
  return data;
}

export async function assignDeliveryRider(orderId: number, riderId: string) {
  if (isDemoMode()) return demo.demoAssign(orderId, riderId);
  const { data, error } = await requireSupabase().rpc('assign_delivery_rider', { p_order_id: orderId, p_rider_id: riderId });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t assign this rider.'));
  return data;
}

export async function verifyPayment(paymentId: number, method: string) {
  if (isDemoMode()) { const pay = demo.demoOverview({ role: 'admin', id: demo.demoCurrentUserId() }).payments.find((x: any) => x.payment_id === paymentId); return demo.demoMarkOrderPaid(pay.order_id); }
  // Payment verification must go through the database RPC. The RPC enforces
  // staff/admin authorization and atomically updates the payment, order,
  // sales ledger, notifications, and audit log without granting direct table writes.
  const { data, error } = await requireSupabase().rpc('verify_payment', {
    p_payment_id: paymentId,
    p_payment_method: method,
  });

  if (error) {
    throw new Error(friendlyError(error, 'We couldn\u2019t record this payment.'));
  }

  return data;
}

/** Product image CRUD via Supabase Storage + inventory.image_url (written through an RPC; clients have no direct UPDATE on inventory). */
/** Shrinks a photo in the browser so it fits comfortably in the offline demo's local storage. */
async function photoToDataUrl(file: File, maxSide = 640): Promise<string> {
  const raw: string = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("We couldn’t read this photo.")); r.readAsDataURL(file); });
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("bad image")); i.src = raw; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d"); if (!ctx) return raw;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch { return raw; }
}

export async function saveInventoryImage(inventoryId: number | string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (isDemoMode()) { const url = await photoToDataUrl(file); demo.demoSetImage(Number(inventoryId), url); return url; }
  const db = requireSupabase();
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be 5 MB or smaller.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `inventory/${inventoryId}.${ext}`;
  const { error: uploadError } = await db.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploadError) {
        throw new Error(friendlyError(uploadError, 'We couldn\u2019t upload this photo.'));
  }
  const { data } = db.storage.from("product-images").getPublicUrl(path);
  const imageUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await db.rpc("set_inventory_image", { p_inventory_id: Number(inventoryId), p_image_url: imageUrl });
  if (updateError) {
    await db.storage.from("product-images").remove([path]);
    throw new Error(friendlyError(updateError, 'The photo was uploaded but could not be attached to the item.'));
  }
  return imageUrl;
}

export async function deleteInventoryImage(inventoryId: number | string, imageUrl?: string | null) {
  if (isDemoMode()) { demo.demoSetImage(Number(inventoryId), null); return; }
  const db = requireSupabase();
  const { error: updateError } = await db.rpc("set_inventory_image", { p_inventory_id: Number(inventoryId), p_image_url: null });
  if (updateError) throw new Error(friendlyError(updateError, 'We couldn\u2019t remove this photo.'));
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      const marker = "/storage/v1/object/public/product-images/";
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        const path = decodeURIComponent(url.pathname.slice(index + marker.length));
        const { error } = await db.storage.from("product-images").remove([path]);
        if (error) console.warn("Image metadata cleared, but storage cleanup failed:", error.message);
      }
    } catch (e) { console.warn("Could not parse product image URL for storage cleanup", e); }
  }
}

export async function adjustInventory(inventoryId: number | string, delta: number) {
  if (isDemoMode()) return demo.demoAdjust(Number(inventoryId), Math.trunc(Number(delta)));
  const { data, error } = await requireSupabase().rpc('adjust_inventory_stock', { p_inventory_id: Number(inventoryId), p_delta: Math.trunc(Number(delta)) });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t adjust the stock.'));
  return data;
}

export async function markNotificationsRead() {
  if (isDemoMode()) return demo.demoMarkNotificationsRead();
  const db = requireSupabase();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('You must be signed in to update notifications.');
  const { data, error } = await db.from('notifications').update({ unread: false }).eq('user_id', authData.user.id).eq('unread', true);
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (isDemoMode()) return demo.demoSignOut();
  const { error } = await requireSupabase().auth.signOut(); 
  if(error) throw error; 
}

export async function updateUserRole(userId: string, newRole: string) {
  if (isDemoMode()) return demo.demoUpdateRole(userId, newRole);
  const { error } = await requireSupabase().rpc('admin_update_user_role', {
    p_user_id: userId,
    p_new_role: newRole
  });
  if (error) throw error;
}

export async function insertWalkInOrder({ customer_id, walk_in_name, items }: { customer_id?: string | null; walk_in_name?: string; items: { inventory_id: number; quantity: number }[] }) {
  if (isDemoMode()) return demo.demoWalkIn({ customer_id, walk_in_name, items }) as unknown as Order;
  // One atomic RPC: validates stock, deducts it, and records order, items, cash payment and sale.
  // customer_id = registered customer; otherwise the order is stored under walk_in_name.
  const { data, error } = await requireSupabase().rpc('place_walk_in_order', {
    p_customer_id: customer_id || null,
    p_walk_in_name: customer_id ? null : (walk_in_name?.trim() || null),
    p_items: items.map(({ inventory_id, quantity }) => ({ inventory_id, quantity })),
  });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t record this sale.'));
  return data as Order;
}


// ---------------------------------------------------------------------------------------------
// Authentication wrapper (real or offline demo)
// ---------------------------------------------------------------------------------------------
async function currentDemoProfile(): Promise<Profile> { return demo.demoProfile(demo.demoCurrentUserId()) as Profile; }

export const authApi = {
  async getSession(): Promise<any> {
    if (isDemoMode()) return demo.getDemoSession();
    const { data, error } = await requireSupabase().auth.getSession(); if (error) throw error; return data.session;
  },
  onChange(cb: (event: string, session: any) => void): () => void {
    if (isDemoMode()) return () => {};
    const { data } = requireSupabase().auth.onAuthStateChange((event: any, session: any) => cb(event, session));
    return () => data.subscription.unsubscribe();
  },
  async signIn(email: string, password: string) {
    if (isDemoMode()) return demo.demoSignIn(email, password);
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password }); if (error) throw new Error(friendlyError(error, 'We couldn\u2019t sign you in.'));
  },
  async signUp(email: string, password: string, fullName: string): Promise<{ needsEmailConfirmation: boolean }> {
    if (isDemoMode()) { demo.demoSignUp(email, password, fullName); return { needsEmailConfirmation: false }; }
    const { data, error } = await requireSupabase().auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) throw new Error(friendlyError(error, 'We couldn\u2019t create your account.'));
    return { needsEmailConfirmation: !data.session };
  },
  async changePassword(current: string, next: string, email: string) {
    if (isDemoMode()) return demo.demoChangePassword(current, next);
    const db = requireSupabase();
    const { error: reauth } = await db.auth.signInWithPassword({ email, password: current });
    if (reauth) throw new Error('Your current password is incorrect.');
    const { error } = await db.auth.updateUser({ password: next }); if (error) throw new Error(friendlyError(error, 'We couldn\u2019t change your password.'));
  },
};

// ---------------------------------------------------------------------------------------------
// Inventory management (create / update / delete)
// ---------------------------------------------------------------------------------------------
export const INVENTORY_CATEGORIES = ['Refill', 'Round Gallon', 'Slim Gallon', 'Caps', 'Seals', 'Hardware'] as const;
export interface InventoryInput { name: string; category: string; price: number; stock: number; min_stock: number; }

export async function createInventoryItem(v: InventoryInput) {
  if (isDemoMode()) return demo.demoCreateItem(v);
  const { data, error } = await requireSupabase().rpc('create_inventory_item', { p_name: v.name.trim(), p_category: v.category, p_price: Number(v.price), p_stock: Math.trunc(Number(v.stock)), p_min_stock: Math.trunc(Number(v.min_stock)) });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t add this item.'));
  return data;
}
export async function updateInventoryItem(id: number, v: InventoryInput) {
  if (isDemoMode()) return demo.demoUpdateItem(id, v);
  const { data, error } = await requireSupabase().rpc('update_inventory_item', { p_id: id, p_name: v.name.trim(), p_category: v.category, p_price: Number(v.price), p_stock: Math.trunc(Number(v.stock)), p_min_stock: Math.trunc(Number(v.min_stock)) });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t save this item.'));
  return data;
}
export async function deleteInventoryItem(id: number) {
  if (isDemoMode()) return demo.demoDeleteItem(id);
  const { error } = await requireSupabase().rpc('delete_inventory_item', { p_id: id });
  if (error) throw new Error(/order history|referenced|foreign key/i.test(error.message) ? 'This item has order history and can\u2019t be deleted. Set its stock to zero instead to stop selling it.' : friendlyError(error, 'We couldn\u2019t delete this item.'));
}

// ---------------------------------------------------------------------------------------------
// Receipts, per-order payments, statements
// ---------------------------------------------------------------------------------------------
export async function loadOrderItems(orderIds: number[]): Promise<any[]> {
  if (isDemoMode()) return demo.demoOrderItems(orderIds);
  const { data, error } = await requireSupabase().from('order_items').select('*').in('order_id', orderIds);
  if (error) throw new Error(friendlyError(error)); return data || [];
}

export async function getReceipt(orderId: number): Promise<Receipt> {
  if (isDemoMode()) return demo.demoReceipt(orderId);
  const db = requireSupabase();
  const [{ data: order, error }, { data: items }, { data: pays }, { data: inv }] = await Promise.all([
    db.from('orders').select('*').eq('id', orderId).single(),
    db.from('order_items').select('*').eq('order_id', orderId),
    db.from('payments').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    db.from('inventory').select('id,name,price'),
  ]);
  if (error || !order) throw new Error('We couldn\u2019t load this receipt.');
  let customerName: string | null = null; let phone: string | null = null; let riderName: string | null = null;
  try { const { data: info } = await db.rpc('get_order_customer_info', { p_order_ids: [orderId] }); customerName = info?.[0]?.customer_name || null; } catch { /* optional */ }
  if (order.customer_id) { try { const { data: c } = await db.from('profiles').select('full_name,phone').eq('id', order.customer_id).maybeSingle(); customerName = customerName || c?.full_name || null; phone = c?.phone || null; } catch { /* optional */ } }
  if (order.rider_id) { try { const { data: r } = await db.rpc('get_delivery_rider_names', { p_rider_ids: [order.rider_id] }); riderName = r?.[0]?.full_name || null; } catch { /* optional */ } }
  return buildReceipt({ order, items: items || [], inventory: inv || [], payment: (pays || [])[0], customerName, customerPhone: phone, riderName });
}

/** Per-order payment: records that this one order has been paid (cash at pickup / cash on delivery). */
export async function markOrderPaid(orderId: number) {
  if (isDemoMode()) return demo.demoMarkOrderPaid(orderId);
  const { data, error } = await requireSupabase().rpc('mark_order_paid', { p_order_id: orderId });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t record this payment.'));
  return data;
}

export async function setRolePermission(role: 'staff' | 'delivery', permission: string, enabled: boolean) {
  if (isDemoMode()) return demo.demoSetPermission(role, permission, enabled);
  const { error } = await requireSupabase().rpc('admin_set_permission', { p_role: role, p_permission: permission, p_enabled: enabled });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t save this permission.'));
}

/** Rider shares a real GPS position. Sent automatically while a delivery is out, or on demand from the Live Map. */
export async function shareRiderLocation(lat: number, lng: number) {
  if (isDemoMode()) { demo.demoShareLocation(lat, lng); return; }
  const { error } = await requireSupabase().rpc('update_rider_location', { p_lat: lat, p_lng: lng });
  if (error) console.warn('[AquaWell] location not saved', error.message);
}

/** Latest known rider positions that the signed-in person is allowed to see (staff: all, customer: their own rider). */
export async function loadRiderLocations(): Promise<any[]> {
  if (isDemoMode()) return demo.demoRiderLocations();
  try {
    const { data } = await requireSupabase().from('rider_locations').select('rider_id,lat,lng,updated_at');
    return data || [];
  } catch { return []; }
}

/** The shop's pinned position; the default coordinates are used until the owner or staff pins it. */
export async function loadStationLocation(): Promise<StationPin> {
  if (isDemoMode()) return demo.demoStation();
  try {
    const { data, error } = await requireSupabase().from('station_settings').select('lat,lng,label,updated_at').eq('id', 1).maybeSingle();
    if (error || !data) return DEFAULT_STATION_PIN;
    return { lat: Number(data.lat), lng: Number(data.lng), label: data.label, updated_at: data.updated_at, pinned: true };
  } catch { return DEFAULT_STATION_PIN; }
}

/** Customer saves or moves their delivery pin. */
export async function saveMyDeliveryPin(lat: number, lng: number) {
  if (isDemoMode()) return demo.demoSetPin(lat, lng);
  const { error } = await requireSupabase().rpc('set_my_delivery_pin', { p_lat: lat, p_lng: lng });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t save your pin.'));
}
/** Customer removes their pin. Refused while a delivery is pending, being prepared or on the road. */
export async function clearMyDeliveryPin() {
  if (isDemoMode()) return demo.demoClearPin();
  const { error } = await requireSupabase().rpc('clear_my_delivery_pin');
  if (error) throw new Error(/active delivery/i.test(error.message) ? 'You have an active delivery. You can remove your pin once it is completed.' : friendlyError(error, 'We couldn\u2019t remove your pin.'));
}

/** Owner (admin) and staff pin the shop on the map. */
export async function saveStationLocation(lat: number, lng: number, label: string | null): Promise<StationPin> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Choose a valid location on the map.');
  if (isDemoMode()) return demo.demoSetStation(lat, lng, label);
  const { error } = await requireSupabase().rpc('set_station_location', { p_lat: lat, p_lng: lng, p_label: label });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t save the shop location.'));
  return { lat, lng, label, updated_at: new Date().toISOString(), pinned: true };
}

// ---------------------------------------------------------------------------------------------
// Customer privacy: data export and account deletion
// ---------------------------------------------------------------------------------------------
export async function exportMyData() {
  if (isDemoMode()) return demo.demoExportMyData();
  const { data, error } = await requireSupabase().rpc('export_my_data');
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t prepare your data.'));
  return data;
}
export async function deleteMyAccount(password: string, email: string) {
  if (isDemoMode()) return demo.demoDeleteAccount(password);
  const db = requireSupabase();
  const { error: reauth } = await db.auth.signInWithPassword({ email, password });
  if (reauth) throw new Error('That password is incorrect.');
  const { error } = await db.rpc('delete_my_account');
  if (error) throw new Error(/active order/i.test(error.message) ? 'You still have an active order. Please wait until it is completed or cancel it before deleting your account.' : friendlyError(error, 'We couldn\u2019t delete your account.'));
  await db.auth.signOut();
}

// ---------------------------------------------------------------------------------------------
// Companies and monthly corporate statements
// ---------------------------------------------------------------------------------------------
export async function loadCompanyData() {
  if (isDemoMode()) return demo.demoCompanyData();
  const db = requireSupabase();
  const [co, cu, af, bi] = await Promise.all([
    db.from('companies').select('*').order('name'),
    db.from('profiles').select('id,full_name,email').eq('role', 'customer').order('full_name'),
    db.from('customer_company_affiliations').select('id,customer_id,company_id,affiliation_type,active,profiles!customer_company_affiliations_customer_id_fkey(full_name,email),companies!customer_company_affiliations_company_id_fkey(name)').order('created_at', { ascending: false }),
    db.from('company_billing_records').select('id,company_id,billing_period,amount_due,amount_paid,status,payment_reference,companies!company_billing_records_company_id_fkey(name)').order('billing_period', { ascending: false }).limit(100),
  ]);
  for (const r of [co, cu, af, bi]) if (r.error) throw new Error(friendlyError(r.error, 'We couldn\u2019t load company records.'));
  return { companies: co.data || [], customers: cu.data || [], affiliations: af.data || [], bills: bi.data || [] };
}
export async function createCompany(v: { name: string; focal_person_name: string; contact_information: string | null }) {
  if (isDemoMode()) return demo.demoCreateCompany(v);
  const { error } = await requireSupabase().from('companies').insert(v); if (error) throw new Error(friendlyError(error, 'We couldn\u2019t add this company.'));
}
export async function addCompanyAffiliation(customerId: string, companyId: number) {
  if (isDemoMode()) return demo.demoAddAffiliation(customerId, companyId);
  const { error } = await requireSupabase().from('customer_company_affiliations').upsert({ customer_id: customerId, company_id: companyId, affiliation_type: 'Member', active: true }, { onConflict: 'customer_id,company_id' });
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t assign this customer.'));
}
export async function markCompanyBillPaid(billId: number, reference: string | null, amountDue: number) {
  if (isDemoMode()) return demo.demoMarkBillPaid(billId, reference);
  const { error } = await requireSupabase().from('company_billing_records').update({ amount_paid: amountDue, status: 'PAID', payment_reference: reference }).eq('id', billId);
  if (error) throw new Error(friendlyError(error, 'We couldn\u2019t record this payment.'));
}

/** Consolidated monthly statement for one company (all affiliated customers' completed orders in that month). */
export async function loadCompanyStatement(companyId: number, period: string): Promise<Statement> {
  if (isDemoMode()) return demo.demoStatement(companyId, period);
  const db = requireSupabase();
  const { data: company } = await db.from('companies').select('*').eq('id', companyId).single();
  if (!company) throw new Error('Company not found.');
  const { data: aff } = await db.from('customer_company_affiliations').select('customer_id').eq('company_id', companyId).eq('active', true);
  const ids = (aff || []).map((a: any) => a.customer_id);
  const { data: orders } = ids.length ? await db.from('orders').select('*').in('customer_id', ids).in('status', ['DELIVERED', 'PICKED UP']) : { data: [] as any[] };
  const orderIds = (orders || []).map((o: any) => o.id);
  const [{ data: items }, { data: pays }, { data: inv }, { data: people }, { data: bill }] = await Promise.all([
    orderIds.length ? db.from('order_items').select('*').in('order_id', orderIds) : Promise.resolve({ data: [] as any[] }),
    orderIds.length ? db.from('payments').select('*').in('order_id', orderIds) : Promise.resolve({ data: [] as any[] }),
    db.from('inventory').select('id,name,price'),
    ids.length ? db.from('profiles').select('id,full_name').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    db.from('company_billing_records').select('*').eq('company_id', companyId).eq('billing_period', `${period}-01`).maybeSingle(),
  ]);
  const itemsByOrder: Record<string, any[]> = {}; (items || []).forEach((l: any) => { (itemsByOrder[l.order_id] ||= []).push(l); });
  return buildStatement({ company, period, orders: orders || [], itemsByOrder, inventory: inv || [], customerNames: Object.fromEntries((people || []).map((p: any) => [p.id, p.full_name])), payments: pays || [], bill });
}
export async function saveCompanyBill(companyId: number, period: string) {
  if (isDemoMode()) return demo.demoSaveBill(companyId, period);
  const st = await loadCompanyStatement(companyId, period); const db = requireSupabase();
  const { data: existing } = await db.from('company_billing_records').select('*').eq('company_id', companyId).eq('billing_period', `${period}-01`).maybeSingle();
  if (existing) {
    if (existing.status === 'VOID') throw new Error('This month\u2019s bill was voided and cannot be recalculated.');
    const paid = Number(existing.amount_paid) || 0; if (st.subtotal < paid) throw new Error('The company has already paid more than the calculated total.');
    const status = paid >= st.subtotal ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
    const { error } = await db.from('company_billing_records').update({ amount_due: st.subtotal, status }).eq('id', existing.id); if (error) throw new Error(friendlyError(error));
  } else {
    const { error } = await db.from('company_billing_records').insert({ company_id: companyId, billing_period: `${period}-01`, amount_due: st.subtotal, amount_paid: 0, status: st.subtotal === 0 ? 'PAID' : 'UNPAID' }); if (error) throw new Error(friendlyError(error));
  }
}
