import { requireSupabase } from './supabase';

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
}

export interface CustomerOrderPayload {
  fulfillment: string;
  address?: string;
  items: { inventory_id: number; quantity: number }[];
}

// --- Functions ---

export function normalizeRole(value: unknown): Profile["role"] {
  const role = String(value || "").trim().toLowerCase();
  if (!["admin", "staff", "delivery", "customer"].includes(role)) {
    throw new Error("Unsupported account role: " + String(value || "(empty)"));
  }
  return role as Profile["role"];
}

export function canAccessPage(roleValue: unknown, page: string): boolean {
  let role: string;
  try { role = normalizeRole(roleValue); } catch { return false; }
  const pages: Record<string, string[]> = {
    admin: ["Overview", "Notifications", "Orders", "Rider Status", "Companies", "Inventory", "Payments", "Sales & Forecasts", "People & Roles", "Audit Log", "Account"],
    staff: ["Overview", "Notifications", "Orders", "Rider Status", "Payments", "Customers", "Companies", "Account"],
    delivery: ["Overview", "Notifications", "My Deliveries", "Account"],
    customer: ["Overview", "Notifications", "Order", "My Orders", "Account"],
  };
  return (pages[role] || []).includes(page);
}

export async function updateOwnProfile(values: { full_name: string; phone: string | null; address: string | null; barangay: string | null; landmark: string | null }): Promise<Profile> {
  const db = requireSupabase();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error("You must be signed in to update your profile.");
  const { data, error } = await db.from("profiles").update(values).eq("id", userId)
    .select("id,full_name,email,phone,address,barangay,landmark,role,delivery_availability,created_at").single();
  if (error) throw error;
  return { ...data, role: normalizeRole(data.role) };
}

export async function getCurrentProfile(userId: string): Promise<Profile> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('profiles')
    .select('id,full_name,email,phone,address,barangay,landmark,role,delivery_availability,created_at')
    .eq('id', userId)
    .maybeSingle();
    
  if (error) throw error;
  if (!data) throw new Error('Your authenticated account has no matching public.profiles row. Ask an administrator to repair the account role/profile; access will not default to Customer.');
  
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
    if (customerRows.error) throw new Error(`Could not load registered customers: ${customerRows.error.message}`);
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
      result.forecastError = `Could not load WMA forecasts: ${failed.error.message}. Apply migration 202610200001_walkin_inventory_storage_wma_audit_fixes.sql in Supabase.`;
    }
  }

  const { data: notifications, error: notificationError } = await db.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20);
  if (notificationError) throw new Error(`Could not load notifications: ${notificationError.message}`);
  result.notifications = (notifications as NotificationMsg[]) || [];
  // Workflow priority is the primary display criterion; timestamp is only a tie-breaker.
  result.orders.sort((a, b) => workflowPriority(a, role) - workflowPriority(b, role)
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    || String(a.order_reference || a.id).localeCompare(String(b.order_reference || b.id)));
  
  return result;
}

export async function createCustomerOrder({ fulfillment, address, items }: CustomerOrderPayload) {
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
    // Station Pickup is Cash only. Delivery defaults to Cash on Delivery.
    p_payment_method: fulfillment === 'Pickup' ? 'Cash' : 'Cash on Delivery',
  });

  if (error) throw error;
  if (!order) throw new Error("The order was not returned by the server. Please refresh your orders before retrying.");
  return order as Order;
}


export async function confirmOrder(orderId: number) {
  const { data, error } = await requireSupabase().rpc(
    'confirm_order_and_deduct_stock',
    { p_order_id: orderId }
  );

  if (error) {
    throw new Error(
      `Could not confirm order #${orderId}: ${error.message}. ` +
      'Confirm that the confirmation RPC is deployed and executable.'
    );
  }

  if (!data) {
    throw new Error(
      `Order #${orderId} was not returned after confirmation.`
    );
  }

  return data as Order;
}


export async function cancelOrder(orderId: number) {
  // Cancellation must be one database transaction: separate browser updates can
  // leave an order cancelled while stock is still deducted (or restore it twice).
  const { data, error } = await requireSupabase().rpc('cancel_order_and_restore_stock', {
    p_order_id: orderId,
  });
  if (error) throw new Error(`Could not cancel order #${orderId}: ${error.message}. Confirm the cancellation RPC migration is deployed.`);
  return data;
}

export async function updateDeliveryStatus(orderId: number, status: string) {
  if (!['OUT FOR-DELIVERY', 'DELIVERED'].includes(status)) throw new Error('Unsupported delivery status.');
  const { data, error } = await requireSupabase().rpc('update_assigned_delivery_status', { p_order_id: orderId, p_status: status });
  if (error) throw new Error(`Could not update delivery status: ${error.message}. Confirm the delivery workflow migration is deployed.`);
  return data;
}

export async function confirmCustomerReceipt(orderId: number) {
  const db = requireSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('You must be signed in.');
  const { data, error } = await db.rpc('confirm_customer_order_receipt', { p_order_id: orderId });
  if (error) throw new Error(`Could not confirm receipt: ${error.message}. Confirm the delivery-confirmation migration is deployed.`);
  return data;
}

export async function updateRiderAvailability(availability: 'AVAILABLE' | 'UNAVAILABLE') {
  const { data, error } = await requireSupabase().rpc('set_delivery_availability', { p_availability: availability });
  if (error) throw new Error(`Could not update rider availability: ${error.message}. Confirm the delivery workflow migration is deployed.`);
  return data;
}

export async function updatePickupStatus(orderId: number, status: string) {
  if (!['READY FOR PICKUP', 'PICKED UP'].includes(status)) throw new Error('Unsupported pickup status.');
  // Clients have no direct UPDATE on orders; the status change goes through an RPC.
  const { data, error } = await requireSupabase().rpc('update_pickup_status', { p_order_id: orderId, p_status: status });
  if (error) throw new Error(`Could not update pickup status: ${error.message}${/update_pickup_status/.test(error.message) ? ' Apply migration 202610200002_pickup_status_rpc.sql.' : ''}`);
  return data;
}

export async function rejectDeliveryAssignment(orderId: number) {
  const { data, error } = await requireSupabase().rpc('reject_delivery_assignment', { p_order_id: orderId });
  if (error) throw new Error(`Could not reject assignment: ${error.message}. Confirm the delivery workflow migration is deployed.`);
  return data;
}

export async function assignDeliveryRider(orderId: number, riderId: string) {
  const { data, error } = await requireSupabase().rpc('assign_delivery_rider', { p_order_id: orderId, p_rider_id: riderId });
  if (error) throw new Error(`Could not assign rider: ${error.message}. Confirm the delivery workflow migration is deployed.`);
  return data;
}

export async function verifyPayment(paymentId: number, method: string) {
  // Payment verification must go through the database RPC. The RPC enforces
  // staff/admin authorization and atomically updates the payment, order,
  // sales ledger, notifications, and audit log without granting direct table writes.
  const { data, error } = await requireSupabase().rpc('verify_payment', {
    p_payment_id: paymentId,
    p_payment_method: method,
  });

  if (error) {
    throw new Error(`Could not verify payment: ${error.message}`);
  }

  return data;
}

/** Product image CRUD via Supabase Storage + inventory.image_url (written through an RPC; clients have no direct UPDATE on inventory). */
export async function saveInventoryImage(inventoryId: number | string, file: File) {
  const db = requireSupabase();
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be 5 MB or smaller.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `inventory/${inventoryId}.${ext}`;
  const { error: uploadError } = await db.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploadError) {
    const hint = /bucket not found/i.test(uploadError.message) ? " Run migration 202610200001_walkin_inventory_storage_wma_audit_fixes.sql to create the product-images bucket." : "";
    throw new Error(`Could not upload product image: ${uploadError.message}.${hint}`);
  }
  const { data } = db.storage.from("product-images").getPublicUrl(path);
  const imageUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await db.rpc("set_inventory_image", { p_inventory_id: Number(inventoryId), p_image_url: imageUrl });
  if (updateError) {
    await db.storage.from("product-images").remove([path]);
    throw new Error(`Image uploaded but inventory record could not be updated: ${updateError.message}`);
  }
  return imageUrl;
}

export async function deleteInventoryImage(inventoryId: number | string, imageUrl?: string | null) {
  const db = requireSupabase();
  const { error: updateError } = await db.rpc("set_inventory_image", { p_inventory_id: Number(inventoryId), p_image_url: null });
  if (updateError) throw new Error(`Could not remove image from inventory record: ${updateError.message}`);
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
  const { data, error } = await requireSupabase().rpc('adjust_inventory_stock', { p_inventory_id: Number(inventoryId), p_delta: Math.trunc(Number(delta)) });
  if (error) throw new Error(`Could not adjust stock: ${error.message}`);
  return data;
}

export async function markNotificationsRead() {
  const db = requireSupabase();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('You must be signed in to update notifications.');
  const { data, error } = await db.from('notifications').update({ unread: false }).eq('user_id', authData.user.id).eq('unread', true);
  if (error) throw error;
  return data;
}

export async function signOut() { 
  const { error } = await requireSupabase().auth.signOut(); 
  if(error) throw error; 
}

export async function updateUserRole(userId: string, newRole: string) {
  const { error } = await requireSupabase().rpc('admin_update_user_role', {
    p_user_id: userId,
    p_new_role: newRole
  });
  if (error) throw error;
}

export async function insertWalkInOrder({ customer_id, walk_in_name, items }: { customer_id?: string | null; walk_in_name?: string; items: { inventory_id: number; quantity: number }[] }) {
  // One atomic RPC: validates stock, deducts it, and records order, items, cash payment and sale.
  // customer_id = registered customer; otherwise the order is stored under walk_in_name.
  const { data, error } = await requireSupabase().rpc('place_walk_in_order', {
    p_customer_id: customer_id || null,
    p_walk_in_name: customer_id ? null : (walk_in_name?.trim() || null),
    p_items: items.map(({ inventory_id, quantity }) => ({ inventory_id, quantity })),
  });
  if (error) throw new Error(`Could not record walk-in order: ${error.message}${/place_walk_in_order/.test(error.message) ? ' Apply migration 202610200001_walkin_inventory_storage_wma_audit_fixes.sql.' : ''}`);
  return data as Order;
}
