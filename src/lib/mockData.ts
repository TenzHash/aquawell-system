import type { AuditLog, InventoryItem, NotificationMsg, Order, OverviewResult, Payment, Profile, Sale, Staff } from './data';

export const MOCK_MODE_KEY = 'aquawell-data-mode';
const STORE_KEY = 'aquawell-demo-store-v3';
const SESSION_KEY = 'aquawell-demo-user-v1';
const now = new Date();
const ago = (days: number, hours = 10) => { const d = new Date(now); d.setDate(d.getDate() - days); d.setHours(hours, 0, 0, 0); return d.toISOString(); };

export const demoAccounts = [
  { email: 'admin@aquawell.demo', password: 'Demo123!', id: 'demo-admin', full_name: 'AquaWell Administrator', role: 'admin' },
  { email: 'staff@aquawell.demo', password: 'Demo123!', id: 'demo-staff', full_name: 'Mika Santos', role: 'staff' },
  { email: 'rider@aquawell.demo', password: 'Demo123!', id: 'demo-rider', full_name: 'Joshua Reyes', role: 'delivery' },
  { email: 'customer@aquawell.demo', password: 'Demo123!', id: 'demo-customer', full_name: 'Andrea Cruz', role: 'customer', phone: '09171234567', address: '12 Sampaguita Street', barangay: 'Gogon', landmark: 'Near the barangay hall' },
] as const;

function seedStore() {
  const profiles: Profile[] = demoAccounts.map((a) => ({ id: a.id, email: a.email, full_name: a.full_name, role: a.role, phone: 'phone' in a ? a.phone : '', address: 'address' in a ? a.address : '', barangay: 'barangay' in a ? a.barangay : '', landmark: 'landmark' in a ? a.landmark : '', created_at: ago(60) }));
  const inventory: InventoryItem[] = [
    { id: 1, name: '5-Gallon Refill', category: 'Refill', price: 35, stock: 48, min_stock: 10, created_at: ago(50) },
    { id: 2, name: 'Slim Gallon Refill', category: 'Refill', price: 35, stock: 8, min_stock: 10, created_at: ago(40) },
    { id: 3, name: 'Mineral Water 1L', category: 'Refill', price: 20, stock: 75, min_stock: 15, created_at: ago(35) },
    { id: 4, name: 'Empty 5-Gallon Container', category: 'Hardware', price: 180, stock: 12, min_stock: 5, created_at: ago(30) },
    { id: 5, name: 'Hand Pump', category: 'Hardware', price: 95, stock: 4, min_stock: 5, created_at: ago(25) },
  ];
  const orders: Order[] = [
    { id: 1005, customer_id: 'demo-customer', type: 'Delivery', total: 105, status: 'OUT FOR-DELIVERY', payment_status: 'PENDING', created_at: ago(0, 9), address: '12 Sampaguita Street, Gogon', rider_id: 'demo-rider', stock_deducted: true } as Order,
    { id: 1004, customer_id: 'demo-customer', type: 'Pickup', total: 70, status: 'READY FOR PICKUP', payment_status: 'PENDING', created_at: ago(0, 8), address: '', stock_deducted: true } as Order,
    { id: 1003, customer_id: 'demo-customer', type: 'Delivery', total: 140, status: 'DELIVERED', payment_status: 'PAID', created_at: ago(8, 14), address: '12 Sampaguita Street, Gogon', rider_id: 'demo-rider', stock_deducted: true } as Order,
    { id: 1002, customer_id: 'demo-customer', type: 'Pickup', total: 35, status: 'PICKED UP', payment_status: 'PAID', created_at: ago(1, 11), address: '', stock_deducted: true } as Order,
    { id: 1000, customer_id: 'demo-customer', type: 'Pickup', total: 70, status: 'PICKED UP', payment_status: 'PAID', created_at: ago(35, 11), address: '', stock_deducted: true } as Order,
    { id: 1001, customer_id: 'demo-customer', type: 'Delivery', total: 70, status: 'PENDING', payment_status: 'PENDING', created_at: ago(0, 16), address: '12 Sampaguita Street, Gogon' },
  ];
  const payments: Payment[] = orders.map((o, i) => ({ payment_id: 2000 + i, order_id: o.id, amount: o.total, payment_method: o.type === 'Delivery' ? 'Cash on Delivery' : 'Cash', payment_status: o.payment_status, created_at: o.created_at, ...(o.payment_status === 'PAID' ? { paid_at: o.created_at } : {}) }));
  const sales: Sale[] = orders.filter(o => o.payment_status === 'PAID').map((o, i) => { const lines = [{ order_id: 1005, inventory_id: 1, quantity: 3 }, { order_id: 1004, inventory_id: 1, quantity: 2 }, { order_id: 1003, inventory_id: 1, quantity: 4 }, { order_id: 1002, inventory_id: 1, quantity: 1 }, { order_id: 1001, inventory_id: 1, quantity: 2 }, { order_id: 1000, inventory_id: 1, quantity: 2 }].filter(line => line.order_id === o.id); return { transaction_id: 3000 + i, customer_name: 'Andrea Cruz', item_name: lines.map(line => `${inventory.find(item => item.id === line.inventory_id)?.name || 'Item'} × ${line.quantity}`).join(', '), quantity: lines.reduce((sum, line) => sum + line.quantity, 0), total_amount: o.total, payment_method: o.type === 'Delivery' ? 'Cash on Delivery' : 'Cash', date: o.created_at.slice(0, 10), created_at: o.created_at, order_id: o.id }; });
  const orderItems = [
    { order_id: 1005, inventory_id: 1, quantity: 3 },
    { order_id: 1004, inventory_id: 1, quantity: 2 },
    { order_id: 1003, inventory_id: 1, quantity: 4 },
    { order_id: 1002, inventory_id: 1, quantity: 1 },
    { order_id: 1001, inventory_id: 1, quantity: 2 },
    { order_id: 1000, inventory_id: 1, quantity: 2 },
  ];
  const auditLogs: AuditLog[] = [
    { id: 1, user_name: 'AquaWell Administrator', action: 'Reviewed low-stock inventory', log_type: 'INVENTORY', timestamp: ago(0, 9), created_at: ago(0, 9), user_id: 'demo-admin' },
    { id: 2, user_name: 'Mika Santos', action: 'Prepared order #1004 for pickup', log_type: 'ORDER', timestamp: ago(0, 8), created_at: ago(0, 8), user_id: 'demo-staff' },
    { id: 3, user_name: 'Joshua Reyes', action: 'Accepted delivery #1005', log_type: 'DELIVERY', timestamp: ago(0, 9), created_at: ago(0, 9), user_id: 'demo-rider' },
  ];
  const notifications: NotificationMsg[] = [
    { id: 1, title: 'Order update', description: 'Order #1005 is out for delivery.', time: 'Today', unread: true, created_at: ago(0, 9), user_id: 'demo-customer', order_id: 1005 },
    { id: 2, title: 'Order needs review', description: 'Order #1001 is awaiting staff confirmation.', time: 'Today', unread: true, created_at: ago(0, 10), user_id: 'demo-admin', order_id: 1001 },
    { id: 3, title: 'New customer order', description: 'Order #1001 is ready for staff review.', time: 'Today', unread: true, created_at: ago(0, 10), user_id: 'demo-staff', order_id: 1001 },
    { id: 4, title: 'Delivery assignment', description: 'Order #1005 is assigned to your delivery queue.', time: 'Today', unread: true, created_at: ago(0, 9), user_id: 'demo-rider', order_id: 1005 },
  ];
  // Add realistic paid history in prior completed periods so sales and WMA are useful immediately in demo mode.
  let historicOrderId = 5000; let historicPaymentId = 6000; let historicSaleId = 7000;
  for (let daysAgo = 2; daysAgo <= 92; daysAgo += 3) {
    const item = inventory[(Math.floor(daysAgo / 3)) % 3]!;
    const quantity = 1 + (daysAgo % 4);
    const createdAt = ago(daysAgo, 11);
    const order: Order = { id: historicOrderId++, customer_id: 'demo-customer', type: daysAgo % 2 ? 'Pickup' : 'Delivery', total: item.price * quantity, status: daysAgo % 2 ? 'PICKED UP' : 'DELIVERED', payment_status: 'PAID', created_at: createdAt, address: daysAgo % 2 ? '' : '12 Sampaguita Street, Gogon', stock_deducted: true } as Order;
    orders.push(order);
    orderItems.push({ order_id: order.id, inventory_id: item.id, quantity });
    const method = order.type === 'Delivery' ? 'Cash on Delivery' : 'Cash';
    payments.push({ payment_id: historicPaymentId++, order_id: order.id, amount: order.total, payment_method: method, payment_status: 'PAID', created_at: createdAt, paid_at: createdAt });
    sales.push({ transaction_id: historicSaleId++, customer_name: 'Andrea Cruz', item_name: `${item.name} × ${quantity}`, quantity, total_amount: order.total, payment_method: method, date: createdAt.slice(0, 10), created_at: createdAt, order_id: order.id });
  }
  return { profiles, inventory, orders, orderItems, payments, sales, auditLogs, notifications, nextOrderId: historicOrderId, nextPaymentId: historicPaymentId, nextSaleId: historicSaleId };
}

type DemoStore = ReturnType<typeof seedStore>;
let memoryStore: DemoStore | null = null;
function getStore(): DemoStore {
  if (memoryStore) return memoryStore;
  try { const saved = localStorage.getItem(STORE_KEY); if (saved) { memoryStore = JSON.parse(saved); return memoryStore!; } } catch { /* use seed below */ }
  memoryStore = seedStore(); persist(); return memoryStore;
}
function persist() { if (!memoryStore) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(memoryStore)); } catch { /* in-memory demo still works */ } }
export function resetDemoData() { memoryStore = seedStore(); persist(); try { localStorage.removeItem('aquawell-demo-passwords-v1'); localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }
export function getDemoSession() { try { const id = localStorage.getItem(SESSION_KEY); const account = demoAccounts.find(a => a.id === id); return account ? { user: { id: account.id, email: account.email } } : null; } catch { return null; } }
export function demoSignIn(email: string, password: string) {
  let overrides: Record<string, string> = {}; try { overrides = JSON.parse(localStorage.getItem('aquawell-demo-passwords-v1') || '{}'); } catch { /* defaults */ }
  const account = demoAccounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase() && (overrides[a.id] || a.password) === password);
  if (!account) throw new Error('Demo sign-in failed. Choose one of the listed demo accounts and use password Demo123!.');
  localStorage.setItem(SESSION_KEY, account.id);
  return { user: { id: account.id, email: account.email } };
}
export function demoSignOut() { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }
export function changeDemoPassword(oldPassword: string, newPassword: string) { const id = demoCurrentUserId(); const account = demoAccounts.find(a => a.id === id); if (!account) throw new Error('Demo account is not signed in.'); let overrides: Record<string, string> = {}; try { overrides = JSON.parse(localStorage.getItem('aquawell-demo-passwords-v1') || '{}'); } catch { /* defaults */ } if ((overrides[id] || account.password) !== oldPassword) throw new Error('Current password is incorrect.'); overrides[id] = newPassword; localStorage.setItem('aquawell-demo-passwords-v1', JSON.stringify(overrides)); }
// Demo fixtures are opt-in only. Missing Supabase credentials must never silently fall back to mock records.
export function isDemoMode() { return import.meta.env.VITE_DATA_MODE === 'mock'; }
export function getDemoProfile(id: string) { const p = getStore().profiles.find(p => p.id === id); if (!p) throw new Error('Demo profile was not found.'); return { ...p }; }
export function updateDemoProfile(id: string, values: Partial<Profile>) { const s = getStore(); const p = s.profiles.find(p => p.id === id); if (!p) throw new Error('Demo profile was not found.'); Object.assign(p, values); persist(); return { ...p }; }
export function loadDemoOverview(profile: Profile): OverviewResult {
  const s = getStore();
  const orders = profile.role === 'admin' || profile.role === 'staff'
    ? s.orders
    : profile.role === 'delivery'
      ? s.orders.filter(o => o.rider_id === profile.id)
      : s.orders.filter(o => o.customer_id === profile.id);
  const visiblePayments = profile.role === 'customer'
    ? s.payments.filter(p => orders.some(o => o.id === p.order_id))
    : s.payments;

  // Demand is based on paid sales and actual order-item quantities, not guessed quantities from revenue.
  const makeForecast = (period: 'daily' | 'weekly' | 'monthly') => {
    const getBucket = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (period === 'daily') return localDate(d);
      if (period === 'weekly') {
        const day = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - day);
        return localDate(d);
      }
      d.setDate(1);
      return localDate(d).slice(0, 7);
    };
    const now = new Date();
    const currentBucket = getBucket(now);
    const shiftBucket = (bucket: string, offset: number) => {
      const d = period === 'monthly' ? new Date(`${bucket}-01T12:00:00`) : new Date(`${bucket}T12:00:00`);
      if (period === 'daily') d.setDate(d.getDate() + offset);
      else if (period === 'weekly') d.setDate(d.getDate() + offset * 7);
      else d.setMonth(d.getMonth() + offset);
      return getBucket(d);
    };
    const latestCompletedBucket = shiftBucket(currentBucket, -1);
    const buckets = [0, 1, 2].map(i => shiftBucket(latestCompletedBucket, -i));
    const paidOrderIds = new Set(s.orders.filter(o => o.payment_status === 'PAID').map(o => o.id));
    return s.inventory.map(item => {
      const totals = buckets.map(bucket => s.orderItems
        .filter(line => line.inventory_id === item.id && paidOrderIds.has(line.order_id))
        .filter(line => {
          const order = s.orders.find(o => o.id === line.order_id);
          return order ? getBucket(new Date(order.created_at)) === bucket : false;
        })
        .reduce((sum, line) => sum + line.quantity, 0));
      const forecast = totals[0]! * 0.5 + totals[1]! * 0.3 + totals[2]! * 0.2;
      const label = (bucket: string) => period === 'monthly' ? bucket : new Date(`${bucket}T12:00:00`).toLocaleDateString();
      return {
        inventory_id: item.id,
        item_name: item.name,
        newest_period_demand: totals[0],
        previous_period_demand: totals[1],
        oldest_period_demand: totals[2],
        forecast: Number(forecast.toFixed(2)),
        period: label(buckets[0]!),
      };
    });
  };

  return {
    inventory: profile.role === 'admin' || profile.role === 'staff' || profile.role === 'customer' ? s.inventory.map(x => ({ ...x })) : [],
    orders: orders.map(x => ({ ...x })),
    payments: visiblePayments.map(x => ({ ...x })),
    sales: profile.role === 'admin' ? s.sales.map(x => ({ ...x })) : [],
    notifications: s.notifications.filter(n => n.user_id === profile.id).map(x => ({ ...x })),
    profiles: profile.role === 'admin' ? s.profiles.map(x => ({ ...x })) : s.profiles.filter(x => x.role === 'customer').map(x => ({ ...x })),
    riders: s.profiles.filter(p => p.role === 'delivery').map(p => ({ staff_id: p.id, profile_id: p.id, full_name: p.full_name, availability: p.delivery_availability || 'AVAILABLE', role: p.role })) as unknown as Staff[],
    auditLogs: profile.role === 'admin' ? s.auditLogs.map(x => ({ ...x })) : [],
    forecasts: { daily: makeForecast('daily'), weekly: makeForecast('weekly'), monthly: makeForecast('monthly') },
  };
}

function notify(userId: string, title: string, description: string, orderId?: number) { const s = getStore(); const createdAt = new Date().toISOString(); s.notifications.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), title, description, time: 'Just now', unread: true, created_at: createdAt, user_id: userId, ...(orderId ? { order_id: orderId } : {}) }); }
function notifyOperations(title: string, description: string, orderId?: number) { const s = getStore(); s.profiles.filter(p => ['admin', 'staff'].includes(p.role)).forEach(p => notify(p.id, title, description, orderId)); }
function audit(userId: string, action: string, type: string) { const s = getStore(); const p = s.profiles.find(x => x.id === userId); const createdAt = new Date().toISOString(); s.auditLogs.unshift({ id: Date.now(), user_name: p?.full_name || 'Demo user', action, log_type: type, timestamp: createdAt, created_at: createdAt, user_id: userId }); persist(); }
function syncDemoSale(orderId: number) {
  const s = getStore();
  const order = s.orders.find(o => o.id === orderId);
  if (!order) return;
  const payment = s.payments.find(p => p.order_id === orderId);
  if (order.payment_status !== 'PAID' || order.status === 'CANCELLED') {
    s.sales = s.sales.filter(sale => sale.order_id !== orderId);
    return;
  }
  if (s.sales.some(sale => sale.order_id === orderId)) return;
  const lines = s.orderItems.filter(line => line.order_id === orderId);
  const itemNames = lines.map(line => {
    const item = s.inventory.find(i => i.id === line.inventory_id);
    return item ? `${item.name} × ${line.quantity}` : `Item ${line.inventory_id} × ${line.quantity}`;
  });
  s.sales.unshift({
    transaction_id: s.nextSaleId++,
    customer_name: s.profiles.find(p => p.id === order.customer_id)?.full_name || 'Walk-in Customer',
    item_name: itemNames.join(', ') || 'Walk-in sale',
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    total_amount: order.total,
    payment_method: payment?.payment_method || 'Cash',
    date: (payment?.paid_at || new Date().toISOString()).slice(0, 10),
    created_at: payment?.paid_at || new Date().toISOString(),
    order_id: orderId,
  });
}

export function mutateDemoOrder(orderId: number, updates: Partial<Order>, actorId = 'demo-staff') {
  const s = getStore();
  const order = s.orders.find(o => o.id === orderId);
  if (!order) throw new Error(`Demo order #${orderId} was not found.`);
  const lines = s.orderItems.filter(line => line.order_id === orderId);
  const wasDeducted = Boolean((order as any).stock_deducted);
  const confirming = updates.status === 'CONFIRMED' && !wasDeducted;
  if (confirming) {
    for (const line of lines) {
      const item = s.inventory.find(i => i.id === line.inventory_id);
      if (!item || item.stock < line.quantity) throw new Error(`Not enough stock to confirm order #${orderId}.`);
    }
  }
  const previousRiderId = order.rider_id;
  Object.assign(order, updates);
  if (updates.customer_received_at && order.customer_id) notifyOperations('Customer confirmed receipt', `The customer confirmed receipt of order ${orderId}.`, orderId);
  if (updates.rider_id && updates.rider_id !== previousRiderId) {
    const rider = s.profiles.find(p => p.id === updates.rider_id);
    if (rider) notify(rider.id, 'Delivery assigned', `Order #${orderId} has been assigned to you.`, orderId);
    notifyOperations('Rider assigned', `Order #${orderId} was assigned to ${rider?.full_name || 'a delivery rider'}.`, orderId);
  }
  if (updates.rider_id === null && previousRiderId) {
    const previousRider = s.profiles.find(p => p.id === previousRiderId);
    if (previousRider) notify(previousRider.id, 'Delivery returned to queue', `Order #${orderId} was returned to the unassigned queue.`, orderId);
  }
  if (confirming) {
    for (const line of lines) s.inventory.find(i => i.id === line.inventory_id)!.stock -= line.quantity;
    (order as any).stock_deducted = true;
  }
  if (updates.status === 'CANCELLED' && wasDeducted) {
    for (const line of lines) {
      const item = s.inventory.find(i => i.id === line.inventory_id);
      if (item) item.stock += line.quantity;
    }
    (order as any).stock_deducted = false;
  }
  if (updates.payment_status) {
    const payment = s.payments.find(p => p.order_id === orderId);
    if (payment) {
      payment.payment_status = updates.payment_status;
      if (updates.payment_status !== 'PAID') delete payment.paid_at;
      else payment.paid_at ||= new Date().toISOString();
    }
    syncDemoSale(orderId);
  }
  const customerId = order.customer_id;
  if (updates.status === 'CANCELLED') { if (customerId) notify(customerId, 'Order cancelled', `Order #${orderId} was cancelled.`, orderId); notifyOperations('Order cancelled', `Order #${orderId} was cancelled.`, orderId); }
  else if (updates.status) { if (customerId) notify(customerId, 'Order status updated', `Order #${orderId}: ${updates.status}.`, orderId); notifyOperations('Order status updated', `Order #${orderId}: ${updates.status}.`, orderId); }
  audit(actorId, `Updated order #${orderId}: ${Object.entries(updates).map(([key, value]) => `${key}=${value}`).join(', ')}`, 'ORDER');
  persist();
  return { ...order };
}

export function createDemoOrder(profile: Profile, payload: { fulfillment: string; address?: string; items: { inventory_id: number; quantity: number }[] }) { const s = getStore(); if (!payload.items.length) throw new Error('Add at least one item to the order.'); let total = 0; for (const line of payload.items) { const item = s.inventory.find(i => i.id === line.inventory_id); if (!item) throw new Error('An item in this order is unavailable.'); if (line.quantity < 1 || item.stock < line.quantity) throw new Error(`Not enough stock for ${item.name}.`); total += item.price * line.quantity; }
  const order: Order = { id: s.nextOrderId++, customer_id: profile.id, type: payload.fulfillment, total, status: 'PENDING', payment_status: 'PENDING', created_at: new Date().toISOString(), address: payload.address || (payload.fulfillment === 'Delivery' ? profile.address : '') || '' };
  s.orderItems.push(...payload.items.map(line => ({ order_id: order.id, inventory_id: line.inventory_id, quantity: line.quantity })));
  s.orders.unshift(order); s.payments.unshift({ payment_id: s.nextPaymentId++, order_id: order.id, amount: total, payment_method: payload.fulfillment === 'Delivery' ? 'Cash on Delivery' : 'Cash', payment_status: 'PENDING', created_at: order.created_at }); notifyOperations('New customer order', `Order #${order.id} is ready for staff review.`, order.id); notify(profile.id, 'Order submitted', `Your order #${order.id} was submitted and is awaiting staff confirmation.`, order.id); audit(profile.id, `Placed order #${order.id}`, 'ORDER'); persist(); return { ...order }; }
export function createDemoWalkInOrder(customerId: string, items: { inventory_id: number; quantity: number }[], suppliedTotal?: number) {
  const s = getStore();
  const profile = s.profiles.find(p => p.id === customerId);
  if (!profile) throw new Error('Walk-in customer profile was not found.');
  if (!items.length) throw new Error('Add at least one item to the walk-in sale.');
  let total = 0;
  for (const line of items) {
    const item = s.inventory.find(i => i.id === line.inventory_id);
    if (!item) throw new Error(`Inventory item ${line.inventory_id} was not found.`);
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Quantities must be whole numbers greater than zero.');
    if (item.stock < line.quantity) throw new Error(`Not enough stock for ${item.name}.`);
    total += item.price * line.quantity;
  }
  if (suppliedTotal !== undefined && Math.abs(Number(suppliedTotal) - total) > 0.009) throw new Error('The walk-in total does not match the current inventory prices. Refresh and try again.');
  // Walk-in sales are completed cash transactions, so deduct stock and record payment/sale together.
  const createdAt = new Date().toISOString();
  const order: Order = { id: s.nextOrderId++, customer_id: customerId, type: 'Pickup', total, status: 'PICKED UP', payment_status: 'PAID', created_at: createdAt, address: '' };
  for (const line of items) {
    s.inventory.find(i => i.id === line.inventory_id)!.stock -= line.quantity;
    s.orderItems.push({ order_id: order.id, inventory_id: line.inventory_id, quantity: line.quantity });
  }
  (order as any).stock_deducted = true;
  s.orders.unshift(order);
  const payment: Payment = { payment_id: s.nextPaymentId++, order_id: order.id, amount: total, payment_method: 'Cash', payment_status: 'PAID', created_at: createdAt, paid_at: createdAt };
  s.payments.unshift(payment);
  syncDemoSale(order.id);
  notifyOperations('Walk-in sale recorded', `Cash sale #${order.id} was recorded successfully.`, order.id);
  audit(demoCurrentUserId() || 'demo-staff', `Recorded cash walk-in sale #${order.id}`, 'SALE');
  persist();
  return { ...order };
}

export function adjustDemoInventory(id: number | string, delta: number) { const s = getStore(); const item = s.inventory.find(i => i.id === Number(id)); if (!item) throw new Error('Inventory item was not found.'); if (item.stock + delta < 0) throw new Error('Stock cannot be negative.'); item.stock += delta; audit('demo-admin', `${delta >= 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} units of ${item.name}`, 'INVENTORY'); persist(); return { ...item }; }
export function verifyDemoPayment(paymentId: number, method: string) { const s = getStore(); const p = s.payments.find(x => x.payment_id === paymentId); if (!p) throw new Error('Payment record was not found.'); if (p.payment_status === 'CANCELLED') throw new Error('Cancelled payments cannot be verified.'); p.payment_method = method; p.payment_status = 'PAID'; p.paid_at = new Date().toISOString(); const order = s.orders.find(o => o.id === p.order_id); if (order) order.payment_status = 'PAID'; syncDemoSale(p.order_id); if (order?.customer_id) notify(order.customer_id, 'Payment verified', `Payment for order #${p.order_id} has been verified.`, p.order_id); notifyOperations('Payment verified', `Payment for order #${p.order_id} has been verified and recorded in sales.`, p.order_id); audit(demoCurrentUserId() || 'demo-staff', `Verified payment for order #${p.order_id}`, 'PAYMENT'); persist(); return { ...p }; }
export function updateDemoRole(userId: string, role: string) { if (!['admin','staff','delivery','customer'].includes(role)) throw new Error('Unsupported role.'); const p = getStore().profiles.find(x => x.id === userId); if (!p) throw new Error('Profile was not found.'); p.role = role; audit('demo-admin', `Changed ${p.full_name}'s role to ${role}`, 'ACCESS'); persist(); }
export function markDemoNotificationsRead(userId: string) { const s = getStore(); s.notifications.forEach(n => { if (n.user_id === userId) n.unread = false; }); persist(); return true; }
export function demoCurrentUserId() { return getDemoSession()?.user.id || ''; }
