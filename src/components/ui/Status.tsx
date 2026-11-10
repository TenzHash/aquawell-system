import React from "react";

const ORDER_LABELS: Record<string, string> = {
  PENDING: "Awaiting confirmation", CONFIRMED: "Confirmed", "OUT FOR-DELIVERY": "Out for delivery", DELIVERED: "Delivered",
  "READY FOR PICKUP": "Ready for pickup", "PICKED UP": "Picked up", CANCELLED: "Cancelled", "UNABLE TO FULFILL": "Unable to fulfil",
};
const PAYMENT_LABELS: Record<string, string> = { PENDING: "Unpaid", UNPAID: "Unpaid", PAID: "Paid", CANCELLED: "Cancelled", REFUNDED: "Refunded" };

/** Friendly label for an order status (default) or a payment status (kind="payment"). */
export function Status({ status, kind = "order" }: { status?: string; kind?: "order" | "payment" }) {
  const s = String(status || "UNKNOWN");
  const cls = ["PAID", "DELIVERED", "PICKED UP", "READY FOR PICKUP"].includes(s) ? "success"
    : kind === "payment" && ["PENDING", "UNPAID"].includes(s) ? "warning"
    : ["PENDING", "CONFIRMED", "OUT FOR-DELIVERY"].includes(s) ? "warning"
    : ["CANCELLED", "UNABLE TO FULFILL"].includes(s) ? "danger" : "neutral";
  const label = (kind === "payment" ? PAYMENT_LABELS : ORDER_LABELS)[s] || s.replaceAll("_", " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
  return <span className={`status ${cls}`}>{label}</span>;
}
