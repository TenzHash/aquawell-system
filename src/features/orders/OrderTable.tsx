import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Truck,
  Plus,
  X,
  PackageCheck,
  AlertTriangle,
  Banknote,
  Printer,
} from "lucide-react";
import { dateFmt, money } from "../../utils/formatters";
import { Status } from "../../components/ui/Status";
import { EmptyState } from "../../components/ui/EmptyState";
import { TablePagination, TableToolbar } from "../../components/ui/TableControls";
import { WalkInOrderModal } from "./WalkInOrderModal";
import { ReceiptModal } from "../receipts/ReceiptModal";
import { can } from "../../lib/permissions";
import {
  confirmOrder,
  confirmCustomerReceipt,
  cancelOrder,
  updateDeliveryStatus,
  assignDeliveryRider,
  rejectDeliveryAssignment,
  updatePickupStatus,
  insertWalkInOrder,
  markOrderPaid,
} from "../../lib/data";

type ConfirmationType = "receipt" | "reject" | "cancel";

type ConfirmationRequest = {
  type: ConfirmationType;
  orderId: number;
  orderReference: string;
};

const confirmationContent: Record<
  ConfirmationType,
  {
    title: string;
    description: string;
    confirmLabel: string;
    icon: "success" | "warning" | "danger";
  }
> = {
  receipt: {
    title: "Confirm delivery received",
    description:
      "Please confirm that you have received this delivery. This action confirms receipt of your order.",
    confirmLabel: "Yes, I received it",
    icon: "success",
  },
  reject: {
    title: "Reject delivery assignment",
    description:
      "Are you sure you want to reject this delivery? The order will be returned to the unassigned delivery queue.",
    confirmLabel: "Reject delivery",
    icon: "warning",
  },
  cancel: {
    title: "Cancel this order?",
    description:
      "This action will cancel the order. Stock will be reverted if it was already deducted. This action cannot be undone from this dialog.",
    confirmLabel: "Cancel order",
    icon: "danger",
  },
};

const modalIconStyles = {
  success: {
    background: "rgba(34, 197, 94, 0.12)",
    color: "#16a34a",
  },
  warning: {
    background: "rgba(245, 158, 11, 0.14)",
    color: "#d97706",
  },
  danger: {
    background: "rgba(239, 68, 68, 0.12)",
    color: "#dc2626",
  },
};

export function OrderTable({
  orders,
  role,
  action,
  riders = [],
  inventory = [],
  customers = [],
  busy = false,
  hideWalkIn = false,
  query = "",
  setQuery,
  showSearch = false,
  permissions,
  profileId,
}: any) {
  const [receiptFor, setReceiptFor] = useState<number | null>(null);
  const allow = (key: any) => can(role, permissions, key);
  const canConfirm = allow("confirm_orders"), canCancel = allow("cancel_orders"), canWalkIn = allow("walk_in_sales"), canCollect = allow("collect_payments"), canReceipt = role === "customer" || allow("issue_receipts"), canSeeContact = role !== "delivery" || allow("view_customer_contact");
  const canCollectFor = (o: any) => canCollect && o.payment_status === "PENDING" && !(role === "delivery" && !(o.type === "Delivery" && o.rider_id === profileId && ["OUT FOR-DELIVERY", "DELIVERED"].includes(o.status))) && ["CONFIRMED", "OUT FOR-DELIVERY", "DELIVERED", "READY FOR PICKUP", "PICKED UP"].includes(o.status);
  const receiptButton = (o: any) => canReceipt && o.status !== "CANCELLED" && (role !== "customer" || o.status !== "PENDING") ? <button type="button" className="btn small secondary row-btn" onClick={() => setReceiptFor(o.id)}><Printer size={14} /> Receipt</button> : null;
  const payButton = (o: any, ref: string) => canCollectFor(o) ? <button type="button" className="btn small primary row-btn" disabled={busy} onClick={() => action(() => markOrderPaid(o.id), `Payment for ${ref} recorded.`, { confirm: { title: "Record this payment?", message: `Confirm that ${money(o.total)} was received in cash for ${ref}${o.type === "Delivery" ? " on delivery" : ""}.`, confirmLabel: "Payment received" } })}><Banknote size={14} /> Payment received</button> : null;
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const sortedOrders = useMemo(() => [...orders].sort((a: any, b: any) => {
    const diff = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    return sortOrder === "newest" ? -diff : diff;
  }), [orders, sortOrder]);
  const totalRows = sortedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const visibleOrders = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedOrders.slice(start, start + rowsPerPage);
  }, [sortedOrders, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, rowsPerPage, orders.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(
    null,
  );
  const [isConfirming, setIsConfirming] = useState(false);

  const requestConfirmation = (
    type: ConfirmationType,
    orderId: number,
    orderReference: string,
  ) => {
    if (busy || isConfirming) return;

    setConfirmation({
      type,
      orderId,
      orderReference,
    });
  };

  const closeConfirmation = () => {
    if (isConfirming) return;
    setConfirmation(null);
  };

  const handleConfirmation = async () => {
    if (!confirmation || busy || isConfirming) return;

    const currentConfirmation = confirmation;
    setIsConfirming(true);

    try {
      if (currentConfirmation.type === "receipt") {
        await action(
          () => confirmCustomerReceipt(currentConfirmation.orderId),
          "Receipt confirmed. Thank you!",
          { confirm: false },
        );
      } else if (currentConfirmation.type === "reject") {
        await action(
          () => rejectDeliveryAssignment(currentConfirmation.orderId),
          "Delivery rejected and returned to the unassigned queue.",
          { confirm: false },
        );
      } else if (currentConfirmation.type === "cancel") {
        await action(
          () => cancelOrder(currentConfirmation.orderId),
          "Order cancelled successfully.",
          { confirm: false },
        );
      }

      setConfirmation(null);
    } catch (error) {
      // Keep the existing action handler responsible for displaying errors.
      // If it throws, retain the dialog so the user can review the action.
    } finally {
      setIsConfirming(false);
    }
  };

  const currentConfirmationContent = confirmation
    ? confirmationContent[confirmation.type]
    : null;

  return (
    <>
      {showSearch && (
        <TableToolbar
          query={query}
          onQueryChange={(value) => setQuery?.(value)}
          placeholder="Search orders…"
          label="Search orders"
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={setRowsPerPage}
          resultCount={totalRows}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />
      )}

      {["admin", "staff"].includes(role) && canWalkIn && !hideWalkIn && (
        <div className="panel-toolbar order-table-toolbar">
          <button
            type="button"
            className="btn primary"
            onClick={() => setIsWalkInOpen(true)}
            disabled={busy}
          >
            <Plus size={16} /> Walk-in sale
          </button>
        </div>
      )}

      <div className="table-wrap orders-table-wrap orders-table-wrap--paginated">
        <table className="orders-data-table">
          <thead>
            <tr>
              <th>Order</th>
              {role !== "customer" && <th>Customer</th>}
              {role !== "customer" && <th>Company / Affiliation</th>}
              <th>Fulfillment</th>
              {role === "customer" && <th>Rider</th>}
              <th>Amount</th>
              <th>Order status</th>
              <th>Payment</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {visibleOrders.map((o: any) => {
              const orderReference =
                o.order_reference || `AW-${String(o.id).padStart(7, "0")}`;

              return (
                <tr key={o.id}>
                  <td data-label="Order">
                    <strong>{orderReference}</strong>
                    <small className="block">{dateFmt(o.created_at)}</small>
                    {o.address && canSeeContact && (
                      <small className="block address-text">{o.address}</small>
                    )}
                    {o.address && !canSeeContact && <small className="block address-text muted">Address hidden by the station</small>}
                  </td>

                  {role !== "customer" && (
                    <td data-label="Customer">{o.customer_name || "Walk-in customer"}</td>
                  )}
                  {role !== "customer" && (
                    <td data-label="Company / Affiliation">{o.company_affiliation || "No company affiliation"}</td>
                  )}

                  <td data-label="Fulfillment">{o.type}</td>

                  {role === "customer" && (
                    <td data-label="Rider">
                      {o.type === "Delivery"
                        ? o.rider_name ||
                          (o.rider_id
                            ? "Assigned rider"
                            : "Rider will be assigned soon")
                        : "—"}
                    </td>
                  )}

                  <td data-label="Amount" className="money">{money(o.total)}</td>

                  <td data-label="Order status">
                    <Status status={o.status} />
                  </td>

                  <td data-label="Payment">
                    <Status status={o.payment_status} kind="payment" />
                    {role === "customer" && o.payment_status === "PENDING" && o.status !== "CANCELLED" && <small className="block muted">{o.type === "Delivery" ? "Pay the rider on arrival" : "Pay at the station"}</small>}
                  </td>

                  {role === "customer" && (
                    <td data-label="Action" className="action-cell">
                      {receiptButton(o)}
                      {o.type === "Delivery" &&
                        o.status === "DELIVERED" &&
                        !o.customer_received_at && (
                          <button
                            type="button"
                            className="btn small primary"
                            disabled={busy || isConfirming}
                            onClick={() =>
                              requestConfirmation(
                                "receipt",
                                o.id,
                                orderReference,
                              )
                            }
                          >
                            <PackageCheck size={14} />
                            I received my order
                          </button>
                        )}

                      {o.customer_received_at && (
                        <small className="text-success">
                          Receipt confirmed
                        </small>
                      )}
                    </td>
                  )}

                  {role !== "customer" && (
                    <td data-label="Action" className="action-cell">
                      {payButton(o, orderReference)}
                      {receiptButton(o)}
                      {/* PENDING WORKFLOW */}
                      {["admin", "staff"].includes(role) && canConfirm &&
                        o.status === "PENDING" && (
                          <button
                            type="button"
                            className="btn small primary"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              action(
                                () => confirmOrder(o.id),
                                "Order confirmed; stock updated.",
                                { confirm: { title: "Confirm this order?", message: `Confirm ${orderReference}? Stock will be deducted from inventory and the customer will be notified.`, confirmLabel: "Confirm order" } },
                              );
                            }}
                            style={{
                              marginBottom: "8px",
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={14} /> Confirm
                          </button>
                        )}

                      {/* DELIVERY WORKFLOW */}
                      {["admin", "staff"].includes(role) &&
                        ["CONFIRMED", "OUT FOR-DELIVERY"].includes(o.status) &&
                        o.type === "Delivery" && (
                          <select
                            aria-label={`Assign rider for order ${o.id}`}
                            className="compact-select"
                            value={o.rider_id || ""}
                            disabled={busy || Boolean(o.rider_id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              // Read the value now: the dialog re-renders this controlled select back to "".
                              const riderId = e.target.value;
                              if (!riderId) return;
                              void action(
                                () => assignDeliveryRider(o.id, riderId),
                                "Delivery rider assigned.",
                                { confirm: { title: "Assign this rider?", message: `Assign ${riders.find((r: any) => String(r.staff_id) === riderId)?.full_name || "this rider"} to ${orderReference}? The rider will be notified.`, confirmLabel: "Assign rider" } },
                              );
                            }}
                            style={{
                              marginBottom: "8px",
                              width: "100%",
                              height: "32px",
                              minHeight: "32px",
                              boxSizing: "border-box",
                              display: "block",
                            }}
                          >
                            <option value="">Assign rider…</option>
                            {riders
                              .filter(
                                (r: any) =>
                                  r.profile_id === o.rider_id ||
                                  r.availability !== "UNAVAILABLE",
                              )
                              .map((r: any) => (
                                <option key={r.staff_id} value={r.staff_id}>
                                  {r.full_name || "Delivery rider"}
                                  {r.availability === "UNAVAILABLE"
                                    ? " (Unavailable)"
                                    : ""}
                                </option>
                              ))}
                          </select>
                        )}

                      {role === "delivery" &&
                        o.status === "CONFIRMED" &&
                        o.type === "Delivery" &&
                        Boolean(o.rider_id) && (
                          <button
                            type="button"
                            className="btn small secondary"
                            disabled={busy || isConfirming}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestConfirmation(
                                "reject",
                                o.id,
                                orderReference,
                              );
                            }}
                            style={{
                              marginBottom: "8px",
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <X size={14} /> Reject delivery
                          </button>
                        )}

                      {["delivery", "admin", "staff"].includes(role) &&
                        o.status === "CONFIRMED" &&
                        o.type === "Delivery" && (
                          <button
                            type="button"
                            className="btn small primary"
                            disabled={busy || !o.rider_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              action(
                                () =>
                                  updateDeliveryStatus(
                                    o.id,
                                    "OUT FOR-DELIVERY",
                                  ),
                                "Delivery marked out for delivery.",
                                { confirm: { title: role === "delivery" ? "Accept this delivery?" : "Start this delivery?", message: `Mark ${orderReference} as out for delivery? The customer will be notified.`, confirmLabel: role === "delivery" ? "Accept delivery" : "Start delivery" } },
                              );
                            }}
                            style={{
                              marginBottom: "8px",
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <Truck size={14} />
                            {role === "delivery"
                              ? "Accept delivery"
                              : "Start delivery"}
                          </button>
                        )}

                      {["delivery", "admin"].includes(role) &&
                        o.status === "OUT FOR-DELIVERY" &&
                        o.type === "Delivery" && (
                          <button
                            type="button"
                            className="btn small primary"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              action(
                                () => updateDeliveryStatus(o.id, "DELIVERED"),
                                "Delivery completed.",
                                { confirm: { title: "Mark as delivered?", message: `Confirm that ${orderReference} has been handed to the customer.`, confirmLabel: "Mark delivered" } },
                              );
                            }}
                            style={{
                              marginBottom: "8px",
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <CheckCircle2 size={14} /> Mark delivered
                          </button>
                        )}

                      {/* PICKUP WORKFLOW */}
                      {["admin", "staff"].includes(role) &&
                        o.status === "CONFIRMED" &&
                        o.type === "Pickup" && (
                          <button
                            type="button"
                            className="btn small secondary"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              action(
                                () =>
                                  updatePickupStatus(o.id, "READY FOR PICKUP"),
                                "Order marked ready for pickup.",
                                { confirm: { title: "Ready for pickup?", message: `Mark ${orderReference} as ready for station pickup? The customer will be notified.`, confirmLabel: "Mark ready" } },
                              );
                            }}
                            style={{
                              marginBottom: "8px",
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={14} /> Ready for pickup
                          </button>
                        )}

                      {["admin", "staff"].includes(role) &&
                        o.status === "READY FOR PICKUP" &&
                        o.type === "Pickup" && (
                          <button
                            type="button"
                            className="btn small primary"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              action(
                                () => updatePickupStatus(o.id, "PICKED UP"),
                                "Pickup completed.",
                                { confirm: { title: "Mark as picked up?", message: `Confirm that the customer has collected ${orderReference}.`, confirmLabel: "Mark picked up" } },
                              );
                            }}
                            style={{
                              marginBottom: "8px",
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <CheckCircle2 size={14} /> Mark picked up
                          </button>
                        )}

                      {/* ABORT / CANCEL WORKFLOW */}
                      {["admin", "staff"].includes(role) && canCancel &&
                        [
                          "PENDING",
                          "CONFIRMED",
                          "OUT FOR-DELIVERY",
                          "READY FOR PICKUP",
                        ].includes(o.status) && (
                          <button
                            type="button"
                            className="text-button"
                            disabled={busy || isConfirming}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestConfirmation(
                                "cancel",
                                o.id,
                                orderReference,
                              );
                            }}
                            style={{
                              color: "#ef4444",
                              fontSize: "11px",
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                              padding: "4px 0",
                            }}
                          >
                            <X size={12} style={{ marginRight: "4px" }} />
                            Cancel order
                          </button>
                        )}

                      {/* COMPLETED / CANCELLED STATES */}
                      {["DELIVERED", "PICKED UP", "CANCELLED"].includes(
                        o.status,
                      ) && (
                        <span
                          className="muted"
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          {o.status === "CANCELLED"
                            ? "Order Cancelled"
                            : "Completed"}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {!orders.length && (
          <EmptyState
            title={query ? "No matching orders" : "Nothing to show yet"}
            text={query ? "Try a different search term." : "Orders will appear here as soon as they come in."}
          />
        )}
      </div>

      {showSearch && (
        <TablePagination
          page={currentPage}
          pageCount={totalPages}
          onPageChange={setCurrentPage}
          start={totalRows ? (currentPage - 1) * rowsPerPage + 1 : 0}
          end={Math.min(currentPage * rowsPerPage, totalRows)}
          total={totalRows}
        />
      )}

      <WalkInOrderModal
        isOpen={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        inventory={inventory}
        customers={customers}
        busy={busy}
        onSubmit={async (orderData: any) => {
          const succeeded = await action(
            () => insertWalkInOrder(orderData),
            "Walk-in cash sale recorded.",
            { confirm: { title: "Record this walk-in sale?", message: `Record a cash sale of ${money(orderData.total_amount)} for ${orderData.customer_label}? Stock will be deducted immediately.`, confirmLabel: "Record sale" } },
          );
          if (succeeded) setIsWalkInOpen(false);
        }}
      />

      {receiptFor != null && <ReceiptModal orderId={receiptFor} onClose={() => setReceiptFor(null)} />}

      {/* IN-APP CONFIRMATION DIALOG */}
      {confirmation && currentConfirmationContent && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeConfirmation();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeConfirmation();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(15, 23, 42, 0.62)",
            backdropFilter: "blur(4px)",
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="order-confirmation-title"
            aria-describedby="order-confirmation-description"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "440px",
              background: "var(--surface, #ffffff)",
              color: "var(--text, #172033)",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: "18px",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.24)",
              overflow: "hidden",
              animation: "order-confirmation-enter 160ms ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                padding: "24px 24px 18px",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "46px",
                  height: "46px",
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...modalIconStyles[currentConfirmationContent.icon],
                }}
              >
                {currentConfirmationContent.icon === "success" ? (
                  <PackageCheck size={23} />
                ) : currentConfirmationContent.icon === "warning" ? (
                  <AlertTriangle size={23} />
                ) : (
                  <X size={23} />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  id="order-confirmation-title"
                  style={{
                    fontSize: "18px",
                    lineHeight: 1.35,
                    fontWeight: 700,
                    margin: "2px 0 8px",
                    color: "inherit",
                  }}
                >
                  {currentConfirmationContent.title}
                </h2>

                <p
                  id="order-confirmation-description"
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.65,
                    margin: 0,
                    color: "var(--text-muted, #64748b)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {currentConfirmationContent.description}
                </p>

                <div
                  style={{
                    marginTop: "12px",
                    padding: "9px 11px",
                    borderRadius: "9px",
                    background: "var(--surface-muted, #f3f4f6)",
                    fontSize: "12px",
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  Order reference:{" "}
                  <strong
                    style={{
                      color: "var(--text, #172033)",
                      fontWeight: 700,
                    }}
                  >
                    {confirmation.orderReference}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close confirmation dialog"
                onClick={closeConfirmation}
                disabled={isConfirming}
                style={{
                  flexShrink: 0,
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--text-muted, #64748b)",
                  cursor: isConfirming ? "not-allowed" : "pointer",
                  opacity: isConfirming ? 0.5 : 1,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                flexWrap: "wrap",
                gap: "10px",
                padding: "16px 24px 22px",
                borderTop: "1px solid var(--border, #e5e7eb)",
                background: "var(--surface-muted, #fafafa)",
              }}
            >
              <button
                type="button"
                className="btn secondary"
                onClick={closeConfirmation}
                disabled={isConfirming}
                style={{
                  minHeight: "40px",
                  padding: "9px 16px",
                  borderRadius: "9px",
                  cursor: isConfirming ? "not-allowed" : "pointer",
                }}
              >
                {confirmation.type === "receipt" ? "Not yet" : confirmation.type === "reject" ? "Keep delivery" : "Keep order"}
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={handleConfirmation}
                disabled={busy || isConfirming}
                style={{
                  minHeight: "40px",
                  padding: "9px 16px",
                  borderRadius: "9px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background:
                    confirmation.type === "cancel"
                      ? "#dc2626"
                      : confirmation.type === "reject"
                        ? "#d97706"
                        : undefined,
                  borderColor:
                    confirmation.type === "cancel"
                      ? "#dc2626"
                      : confirmation.type === "reject"
                        ? "#d97706"
                        : undefined,
                  color:
                    confirmation.type === "cancel" ||
                    confirmation.type === "reject"
                      ? "#ffffff"
                      : undefined,
                  cursor: busy || isConfirming ? "not-allowed" : "pointer",
                  opacity: busy || isConfirming ? 0.7 : 1,
                }}
              >
                {isConfirming ? (
                  <>
                    <span
                      aria-hidden="true"
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid currentColor",
                        borderRightColor: "transparent",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation:
                          "order-confirmation-spin 700ms linear infinite",
                      }}
                    />
                    Processing…
                  </>
                ) : (
                  currentConfirmationContent.confirmLabel
                )}
              </button>
            </div>
          </section>

          <style>{`
            @keyframes order-confirmation-enter {
              from {
                opacity: 0;
                transform: translateY(8px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            @keyframes order-confirmation-spin {
              to {
                transform: rotate(360deg);
              }
            }

            @media (max-width: 480px) {
              .order-confirmation-actions {
                flex-direction: column-reverse;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .order-confirmation-dialog,
              .order-confirmation-spinner {
                animation: none !important;
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
