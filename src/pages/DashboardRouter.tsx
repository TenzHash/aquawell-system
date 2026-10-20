import React, { useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  CircleDollarSign,
  ClipboardList,
  Package,
  Search,
  Truck,
  Users,
  Building2,
} from "lucide-react";
import { money, dateFmt, roleName, downloadCSV } from "../utils/formatters";
import { Metric } from "../components/ui/Metric";
import { QuickAction } from "../components/ui/QuickAction";
import { Attention } from "../components/ui/Attention";
import { Status } from "../components/ui/Status";
import { EmptyState } from "../components/ui/EmptyState";
import { OrderTable } from "../features/orders/OrderTable";
import { OrderCatalog } from "../features/orders/OrderCatalog";
import { InventoryTable } from "../features/inventory/InventoryTable";
import { SalesTable } from "../features/sales/SalesTable";
import { ForecastTable } from "../features/sales/ForecastTable";
import { PasswordChange } from "../features/auth/PasswordChange";
import { ProfileEditor } from "../features/auth/ProfileEditor";
import { PeopleAndRoles } from "../features/admin/PeopleAndRoles";
import { CompaniesPanel } from "../features/admin/CompaniesPanel";
import { updateRiderAvailability } from "../lib/data";
import { markNotificationsRead, verifyPayment } from "../lib/data";
import { TablePagination, TableToolbar } from "../components/ui/TableControls";
import { ToggleSwitch } from "../components/ui/ToggleSwitch";

export function DashboardRouter({
  page,
  profile,
  data,
  orders,
  query,
  setQuery,
  busy,
  action,
  onNavigate,
  onProfileUpdated,
}: any) {
  const [paymentQuery, setPaymentQuery] = useState("");
  const [paymentRowsPerPage, setPaymentRowsPerPage] = useState(10);
  const [paymentPage, setPaymentPage] = useState(1);
  const [riderQuery, setRiderQuery] = useState("");
  const [riderRowsPerPage, setRiderRowsPerPage] = useState(10);
  const [riderPage, setRiderPage] = useState(1);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(10);
  const [auditPage, setAuditPage] = useState(1);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerRowsPerPage, setCustomerRowsPerPage] = useState(10);
  const [customerPage, setCustomerPage] = useState(1);
  const [notificationQuery, setNotificationQuery] = useState("");
  const inventory = data.inventory || [],
    allOrders = data.orders || [],
    payments = data.payments || [],
    sales = data.sales || [],
    customers =
      data.customers ||
      (data.profiles || [])
        .filter((p: any) => p.role === "customer")
        .map((p: any) => ({ ...p, customer_id: p.id }));

  const filteredPayments = payments.filter((p: any) => [p.order_id, allOrders.find((o: any) => o.id === p.order_id)?.order_reference, p.payment_method, p.payment_status, p.amount].some((value: any) => String(value ?? "").toLowerCase().includes(paymentQuery.toLowerCase())));
  const paymentPageCount = Math.max(1, Math.ceil(filteredPayments.length / paymentRowsPerPage));
  const visiblePayments = filteredPayments.slice((paymentPage - 1) * paymentRowsPerPage, paymentPage * paymentRowsPerPage);
  React.useEffect(() => setPaymentPage(1), [paymentQuery, paymentRowsPerPage]);
  const filteredCustomers = customers.filter((c: any) => [c.full_name, c.name, c.email, c.phone, c.address, c.customer_id, c.id, c.company_name, c.affiliation].some((value: any) => String(value ?? "").toLowerCase().includes(customerQuery.toLowerCase())));
  const customerPageCount = Math.max(1, Math.ceil(filteredCustomers.length / customerRowsPerPage));
  const visibleCustomers = filteredCustomers.slice((customerPage - 1) * customerRowsPerPage, customerPage * customerRowsPerPage);
  React.useEffect(() => setCustomerPage(1), [customerQuery, customerRowsPerPage]);
  const filteredNotifications = (data.notifications || []).filter((n: any) => [n.title, n.description, n.order_id].some((value: any) => String(value ?? "").toLowerCase().includes(notificationQuery.toLowerCase())));
  const totalSales = sales.reduce(
    (n: number, s: any) => n + Number(s.total_amount || 0),
    0,
  );
  const pending = allOrders.filter((o: any) => o.status === "PENDING").length;
  const lowStock = inventory.filter(
    (i: any) => Number(i.stock) <= Number(i.min_stock),
  ).length;

  if (page === "Overview")
    return (
      <>
        {profile.role === "customer" &&
          (!profile.phone || !profile.address) && (
            <div
              className="alert info"
              style={{
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                <strong>Complete your delivery profile:</strong> Please update
                your phone number and delivery address so station staff can
                process your orders smoothly.
              </span>
              <button
                className="btn small primary"
                onClick={() => onNavigate("Account")}
              >
                Update Profile
              </button>
            </div>
          )}
        <div className="metric-grid">
          <Metric
            icon={ClipboardList}
            label={
              profile.role === "customer" ? "Your orders" : "Orders in view"
            }
            value={allOrders.length}
            note={`${pending} awaiting confirmation`}
            tone="teal"
          />
          {profile.role === "admin" && (
            <Metric
              icon={Package}
              label="Inventory items"
              value={inventory.length}
              note={`${lowStock} at or below minimum stock`}
              tone="blue"
            />
          )}
          <Metric
            icon={CircleDollarSign}
            label={
              profile.role === "admin"
                ? "Recorded sales"
                : profile.role === "customer"
                  ? "Your payment records"
                  : "Payments to review"
            }
            value={
              profile.role === "admin" ? money(totalSales) : payments.length
            }
            note={
              profile.role === "admin"
                ? "Confirmed sales ledger"
                : profile.role === "customer"
                  ? "Payment history"
                  : "Manual verification required"
            }
            tone="amber"
          />
          <Metric
            icon={Truck}
            label="Active deliveries"
            value={
              allOrders.filter((o: any) => o.status === "OUT FOR-DELIVERY")
                .length
            }
            note="Currently out for delivery"
            tone="violet"
          />
        </div>
        <div className={`dashboard-grid ${["customer", "delivery"].includes(profile.role) ? "dashboard-grid-single" : ""}`} >
          <section className="panel recent-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {profile.role === "delivery"
                    ? "Assigned deliveries"
                    : "Recent orders"}
                </h2>
                <p>{profile.role === "customer" ? "Your latest orders and their current status" : profile.role === "delivery" ? "Your assigned deliveries and their latest status" : "Latest order activity"}</p>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  onNavigate(
                    profile.role === "delivery"
                      ? "My Deliveries"
                      : profile.role === "customer"
                        ? "My Orders"
                        : "Orders",
                  )
                }
              >
                View all <ArrowRight size={15} />
              </button>
            </div>
            <OrderTable
              orders={allOrders.slice(0, 6)}
              role={profile.role}
              action={action}
              riders={data.riders || []}
              inventory={inventory}
              customers={customers}
              busy={busy}
              hideWalkIn={true}
            />
          </section>
          {!["customer", "delivery"].includes(profile.role) && <section className="panel quick-panel">
            <div className="panel-heading">
              <div>
                <h2>Quick actions</h2>
                <p>Common tasks for your role</p>
              </div>
            </div>
            <div className="quick-actions">
              {profile.role === "admin" && (
                <>
                  <QuickAction
                    icon={Package}
                    title="Review inventory"
                    desc="Stock and low-level items"
                    onClick={() => onNavigate("Inventory")}
                  />
                  <QuickAction
                    icon={Activity}
                    title="Sales & forecasts"
                    desc="Review revenue and demand"
                    onClick={() => onNavigate("Sales & Forecasts")}
                  />
                  <QuickAction
                    icon={Users}
                    title="People & roles"
                    desc="Review account roles"
                    onClick={() => onNavigate("People & Roles")}
                  />
                </>
              )}
              {profile.role === "staff" && (
                <>
                  <QuickAction
                    icon={ClipboardList}
                    title="Confirm orders"
                    desc="Validate stock and accept orders"
                    onClick={() => onNavigate("Orders")}
                  />
                  <QuickAction
                    icon={CircleDollarSign}
                    title="Verify payments"
                    desc="Review payment evidence manually"
                    onClick={() => onNavigate("Payments")}
                  />
                </>
              )}
            </div>
          </section>}
        </div>
        {!["customer", "delivery"].includes(profile.role) && <section className="panel bottom-panel">
          <div className="panel-heading">
            <div>
              <h2>Operational attention</h2>
              <p>Items that may need a staff member’s review</p>
            </div>
          </div>
          <div className="attention-grid">
            {profile.role === "admin" && <Attention
              icon={Package}
              title="Low stock"
              value={lowStock}
              desc="Items at or below their configured minimum"
            />}
            <Attention
              icon={ClipboardList}
              title="Pending orders"
              value={pending}
              desc="Orders awaiting staff confirmation"
            />
            <Attention
              icon={CircleDollarSign}
              title="Payment checks"
              value={payments.filter((p: any) => p.payment_status === "PENDING").length}
              desc="Payments still requiring manual verification"
            />
          </div>
        </section>}
      </>
    );

  if (page === "Rider Status" && ["admin", "staff"].includes(profile.role)) {
    const riders = (data.riders || []).filter((r: any) => [r.full_name, r.availability].some((value: any) => String(value ?? "").toLowerCase().includes(riderQuery.toLowerCase())));
    const riderPageCount = Math.max(1, Math.ceil(riders.length / riderRowsPerPage));
    const visibleRiders = riders.slice((riderPage - 1) * riderRowsPerPage, riderPage * riderRowsPerPage);
    return <section className="panel">
      <div className="panel-heading"><div><h2>Rider availability</h2><p>Availability is separate from delivery progress. Active delivery assignments take precedence over the rider's available/off-duty preference.</p></div></div>
      <TableToolbar query={riderQuery} onQueryChange={value => { setRiderQuery(value); setRiderPage(1); }} placeholder="Search rider name or availability…" label="Search riders" rowsPerPage={riderRowsPerPage} onRowsPerPageChange={value => { setRiderRowsPerPage(value); setRiderPage(1); }} resultCount={riders.length} />
      <div className="table-wrap"><table><thead><tr><th>Rider</th><th>Availability</th><th>Active deliveries</th><th>Current stage</th></tr></thead><tbody>{visibleRiders.map((r: any) => {
        const active = allOrders.filter((o: any) => o.rider_id === r.profile_id && o.type === "Delivery" && ["CONFIRMED", "OUT FOR-DELIVERY", "DELIVERED"].includes(o.status) && !o.customer_received_at);
        const out = active.some((o: any) => o.status === "OUT FOR-DELIVERY");
        const status = out ? "OUT FOR DELIVERY" : (r.availability || "AVAILABLE") === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
        return <tr key={r.profile_id}><td data-label="Rider"><strong>{r.full_name || "Delivery rider"}</strong></td><td data-label="Availability"><span className={`status ${status === "AVAILABLE" ? "success" : status === "UNAVAILABLE" ? "muted" : "warning"}`}>{status === "OUT FOR DELIVERY" ? "Out for delivery" : status === "AVAILABLE" ? "Available" : "Unavailable"}</span></td><td data-label="Active deliveries">{active.length}</td><td data-label="Current stage">{active.map((o: any) => `${o.order_reference || "Order"}: ${o.status}`).join(" · ") || "No active deliveries"}</td></tr>;
      })}</tbody></table>{!riders.length && <p className="muted">No delivery rider profiles found.</p>}</div>
      <TablePagination page={riderPage} pageCount={riderPageCount} onPageChange={setRiderPage} start={riders.length ? (riderPage - 1) * riderRowsPerPage + 1 : 0} end={Math.min(riderPage * riderRowsPerPage, riders.length)} total={riders.length} />
    </section>;
  }

  if (page === "Companies" && ["admin", "staff"].includes(profile.role)) return <CompaniesPanel action={action} busy={busy} role={profile.role} />;

  if (["Orders", "My Orders", "My Deliveries"].includes(page))
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{page}</h2>
            <p>
              {profile.role === "customer"
                ? "Orders connected to your authenticated profile."
                : profile.role === "delivery"
                  ? "Only orders assigned to your linked rider record are shown."
                  : "Review orders and act only within your role permissions."}
            </p>
          </div>
          {profile.role === "delivery" && (() => {
            const available = (profile.delivery_availability || "AVAILABLE") !== "UNAVAILABLE";
            const outForDelivery = allOrders.some((o: any) => o.rider_id === profile.id && o.status === "OUT FOR-DELIVERY");
            return (
              <div className="availability-switch">
                <span className="muted">My availability</span>
                <ToggleSwitch
                  checked={available}
                  disabled={busy || (available && outForDelivery)}
                  label="Delivery availability"
                  onText="Available"
                  offText="Unavailable"
                  title={available && outForDelivery ? "Finish your active delivery before going unavailable." : undefined}
                  onChange={async (next) => {
                    const ok = await action(
                      () => updateRiderAvailability(next ? "AVAILABLE" : "UNAVAILABLE"),
                      next ? "You are marked available for assignments." : "You are marked unavailable.",
                      { confirm: { title: next ? "Go available?" : "Go unavailable?", message: next ? "Staff will be able to assign new deliveries to you." : "You will not receive new delivery assignments until you switch back.", confirmLabel: next ? "Go available" : "Go unavailable", tone: next ? "primary" : "warning" } },
                    );
                    if (ok) onProfileUpdated?.({ ...profile, delivery_availability: next ? "AVAILABLE" : "UNAVAILABLE" });
                  }}
                />
              </div>
            );
          })()}
        </div>
        <OrderTable
          orders={orders}
          query={query}
          setQuery={setQuery}
          showSearch={true}
          role={profile.role}
          action={action}
          riders={data.riders || []}
          inventory={inventory}
          customers={customers}
          busy={busy}
        />
      </section>
    );

  if (page === "Order" && profile.role === "customer")
    return (
      <OrderCatalog
        inventory={inventory}
        profile={profile}
        action={action}
        onNavigate={onNavigate}
      />
    );

  if (page === "Inventory")
    return (
      <InventoryTable
        inventory={inventory}
        role={profile.role}
        action={action}
      />
    );

  if (page === "Payments")
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Payment verification</h2>
            <p>
              Verify physical cash collection before marking the transaction as
              paid.
            </p>
          </div>
          <span className="count-chip">
            {payments.filter((p: any) => p.payment_status === "PENDING").length}{" "}
            pending
          </span>
        </div>
        <TableToolbar query={paymentQuery} onQueryChange={value => { setPaymentQuery(value); setPaymentPage(1); }} placeholder="Search payments by order, method, or status…" label="Search payments" rowsPerPage={paymentRowsPerPage} onRowsPerPageChange={value => { setPaymentRowsPerPage(value); setPaymentPage(1); }} resultCount={filteredPayments.length} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((p: any) => (
                <tr key={p.payment_id}>
                  <td data-label="Order">
                    <strong>{allOrders.find((o: any) => o.id === p.order_id)?.order_reference || `AW-${String(p.order_id).padStart(7, "0")}`}</strong>
                    <small className="block">{dateFmt(p.created_at)}</small>
                  </td>
                  <td data-label="Amount" className="money">{money(p.amount)}</td>
                  <td data-label="Method">{p.payment_method || "Not recorded"}</td>
                  <td data-label="Status">
                    <Status status={p.payment_status} />
                  </td>
                  <td data-label="Action">
                    {["admin", "staff"].includes(profile.role) &&
                      p.payment_status === "PENDING" && (
                        <button
                          className="btn small primary"
                          onClick={() => {
                            const linkedOrder = allOrders.find((o: any) => o.id === p.order_id);
                            const method = linkedOrder?.type === "Delivery" ? "Cash on Delivery" : "Cash";
                            const ref = linkedOrder?.order_reference || `AW-${String(p.order_id).padStart(7, "0")}`;
                            action(
                              () => verifyPayment(p.payment_id, method),
                              "Payment verified; sale recorded.",
                              { confirm: { title: "Verify this payment?", message: `Confirm that ${money(p.amount)} (${method}) was collected for ${ref}. A sale will be recorded.`, confirmLabel: "Verify paid" } },
                            );
                          }}
                          disabled={busy}
                        >
                          <Check size={14} /> Verify paid
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredPayments.length && (
            <EmptyState
              title="No payment records"
              text="Payments will appear here when the database policies permit access."
            />
          )}
        </div>
        <TablePagination page={paymentPage} pageCount={paymentPageCount} onPageChange={setPaymentPage} start={filteredPayments.length ? (paymentPage - 1) * paymentRowsPerPage + 1 : 0} end={Math.min(paymentPage * paymentRowsPerPage, filteredPayments.length)} total={filteredPayments.length} />
      </section>
    );

  if (page === "Sales & Forecasts")
    return (
      <>
        <div className="metric-grid">
          <Metric
            icon={CircleDollarSign}
            label="Recorded sales"
            value={money(totalSales)}
            note={`${sales.length} ledger records`}
            tone="teal"
          />
          <Metric
            icon={Activity}
            label="Sales records"
            value={sales.length}
            note="One ledger row per qualifying order"
            tone="blue"
          />
          <Metric
            icon={Package}
            label="Tracked products"
            value={inventory.length}
            note="Inventory items available for forecasting"
            tone="amber"
          />
          <Metric
            icon={ClipboardList}
            label="Recent orders"
            value={allOrders.length}
            note="Current unarchived orders in view"
            tone="violet"
          />
        </div>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Weighted Moving Average</h2>
              <p>
                Weights 5:3:2; newest completed period receives the highest
                weight.
              </p>
            </div>
          </div>
          <div className="forecast-explainer">
            <div className="formula">
              Forecast = (5 × newest + 3 × previous + 2 × oldest) ÷ 10
            </div>
            <p>
              Forecasts use the three most recent completed daily, weekly, or
              monthly periods. Product demand is derived from order_items joined
              to paid orders; zero-demand periods are included as zero.
            </p>
          </div>
          <ForecastTable forecasts={data.forecasts || {}} error={data.forecastError} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Sales ledger</h2>
              <p>
                Verified paid transactions, recorded once per qualifying order.
              </p>
            </div>
            <button
              className="btn secondary"
              onClick={() => downloadCSV(sales, "aquawell-sales.csv")}
            >
              <ArrowDownToLine size={16} /> Export CSV
            </button>
          </div>
          <SalesTable sales={sales} />
        </section>
      </>
    );

  if (page === "People & Roles")
    return (
      <PeopleAndRoles
        profiles={data.profiles || []}
        action={action}
        busy={busy}
      />
    );

  if (page === "Notifications")
    return (
      <section className="panel">
        <div className="panel-heading">
          <div><h2>Notifications</h2><p>Updates for your account and the orders you can access.</p></div>
          <span className="count-chip">{filteredNotifications.filter((n: any) => n.unread).length} unread</span>
        </div>
        <div className="panel-toolbar">
          <label className="search-box table-search"><Search size={16} /><input value={notificationQuery} onChange={e => setNotificationQuery(e.target.value)} placeholder="Search notifications…" aria-label="Search notifications" /></label>
          <button className="btn small secondary" disabled={!filteredNotifications.some((n: any) => n.unread) || busy} onClick={() => action(() => markNotificationsRead(), "Notifications marked as read.", { confirm: { title: "Mark all as read?", message: "All unread notifications will be marked as read.", confirmLabel: "Mark all read" } })}>Mark all read</button>
        </div>
        <div className="notification-list">
          {filteredNotifications.map((n: any) => (
            <div className="notification-row" key={n.id}>
              <span className="notification-icon"><Bell size={17} /></span>
              <div><strong>{n.title}</strong><p>{n.description}</p><small>{dateFmt(n.created_at)} {n.unread ? "· Unread" : "· Read"}</small></div>
              {n.order_id && <button className="btn small secondary" onClick={() => onNavigate(profile.role === "customer" ? "My Orders" : profile.role === "delivery" ? "My Deliveries" : "Orders")}>View order</button>}
            </div>
          ))}
          {!filteredNotifications.length && <EmptyState title="You're all caught up" text="New order, payment, and delivery updates will appear here." />}
        </div>
      </section>
    );

  if (page === "Audit Log") {
    // Show people by name, never by UUID: map any ID in the stored text to the profile's name.
    const nameById = new Map<string, string>((data.profiles || []).map((p: any) => [String(p.id).toLowerCase(), p.full_name || p.email || "Unnamed user"]));
    const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    const readable = (text: any) => String(text ?? "").replace(new RegExp(uuidPattern, "gi"), (id) => nameById.get(id.toLowerCase()) || "a user");
    const actorName = (log: any) => {
      const stored = String(log.user_name ?? "").trim();
      if (stored && !new RegExp(`^${uuidPattern}$`, "i").test(stored)) return stored;
      return nameById.get(String(log.user_id ?? "").toLowerCase()) || "System";
    };
    const auditLogs = (data.auditLogs || []).filter((log: any) => [actorName(log), readable(log.action), log.log_type, dateFmt(log.created_at)].some((value: any) => String(value ?? "").toLowerCase().includes(auditQuery.toLowerCase())));
    const auditPageCount = Math.max(1, Math.ceil(auditLogs.length / auditRowsPerPage));
    const visibleAuditLogs = auditLogs.slice((auditPage - 1) * auditRowsPerPage, auditPage * auditRowsPerPage);
    return (
      <section className="panel">
        <div className="panel-heading">
            <div>
              <h2>Audit log</h2>
              <p>
                Who did what and when. Entries are written by the database
                functions; nothing is fabricated by the client.
              </p>
            </div>
          </div>
          <TableToolbar query={auditQuery} onQueryChange={value => { setAuditQuery(value); setAuditPage(1); }} placeholder="Search audit events, people, or actions…" label="Search audit log" rowsPerPage={auditRowsPerPage} onRowsPerPageChange={value => { setAuditRowsPerPage(value); setAuditPage(1); }} resultCount={auditLogs.length} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {visibleAuditLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td data-label="When">{dateFmt(log.created_at)}</td>
                    <td data-label="User">{actorName(log)}</td>
                    <td data-label="Action">{readable(log.action)}</td>
                    <td data-label="Type">{log.log_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!auditLogs.length && (
              <EmptyState
                title="No audit records visible"
                text="The audit table is empty or restricted by RLS. The current client does not fabricate audit events."
              />
            )}
          </div>
          <TablePagination page={auditPage} pageCount={auditPageCount} onPageChange={setAuditPage} start={auditLogs.length ? (auditPage - 1) * auditRowsPerPage + 1 : 0} end={Math.min(auditPage * auditRowsPerPage, auditLogs.length)} total={auditLogs.length} />
      </section>
    );
  }

  if (page === "Customers")
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Customer records</h2>
            <p>
              Customer details are managed under the existing public.customers
              table.
            </p>
          </div>
        </div>
        <TableToolbar query={customerQuery} onQueryChange={value => { setCustomerQuery(value); setCustomerPage(1); }} placeholder="Search customer name, email, phone, address, or affiliation…" label="Search customers" rowsPerPage={customerRowsPerPage} onRowsPerPageChange={value => { setCustomerRowsPerPage(value); setCustomerPage(1); }} resultCount={filteredCustomers.length} />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Address</th><th>Company / affiliation</th></tr></thead>
            <tbody>{visibleCustomers.map((c: any) => {
              const customerId = c.customer_id || c.id;
              const companyNames = (data.customerCompanies || []).filter((company: any) => company.customer_id === customerId || company.profile_id === customerId).map((company: any) => company.name || company.company_name).filter(Boolean).join(", ");
              return <tr key={customerId}><td data-label="Customer"><strong>{c.full_name || c.name || "Unnamed customer"}</strong></td><td data-label="Email">{c.email || "—"}</td><td data-label="Phone">{c.phone || c.phone_number || "—"}</td><td data-label="Address">{c.address || "—"}</td><td data-label="Company / affiliation">{c.company_name || c.affiliation || companyNames || "—"}</td></tr>;
            })}</tbody>
          </table>
          {!filteredCustomers.length && <EmptyState title="No customer records found" text="No customer records match this search, or no customer records are visible to this account." />}
        </div>
        <TablePagination page={customerPage} pageCount={customerPageCount} onPageChange={setCustomerPage} start={filteredCustomers.length ? (customerPage - 1) * customerRowsPerPage + 1 : 0} end={Math.min(customerPage * customerRowsPerPage, filteredCustomers.length)} total={filteredCustomers.length} />
      </section>
    );

  if (page === "Account")
    return (
      <section className="panel account-panel">
        <div className="panel-heading">
          <div>
            <h2>Your account</h2>
            <p>
              Identity from Supabase Auth and your matching public.profiles row.
            </p>
          </div>
        </div>
        <div className="account-hero">
          <div className="avatar large">
            {(profile.full_name || profile.email || "A")
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div>
            <h3>{profile.full_name || "AquaWell user"}</h3>
            <p>{profile.email}</p>
            <span className="role-chip">{roleName(profile.role)}</span>
          </div>
        </div>
        {profile.role === "customer" && <div className="panel account-details"><div><small>Company affiliations</small><strong>{(data.customerCompanies || []).map((c: any) => c.name).join(", ") || "No company affiliation recorded"}</strong></div></div>}
        <div className="account-details">
          <div><small>Email</small><strong>{profile.email || "Not provided"}</strong></div>
          <div><small>Role</small><strong>{roleName(profile.role)}</strong></div>
        </div>
        <div className="panel-heading account-form-heading"><div><h2>Profile information</h2><p>Update your contact and delivery details.</p></div></div>
        <ProfileEditor profile={profile} onSaved={onProfileUpdated || (() => {})} />
        <PasswordChange />
      </section>
    );

  return (
    <section className="panel">
      <EmptyState
        title="Page not available"
        text="This section is not configured for your role."
      />
    </section>
  );
}
