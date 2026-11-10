import React, { useEffect, useState } from "react";
import { Droplets } from "lucide-react";
import { PrintModal } from "../../components/ui/PrintModal";
import { getReceipt, friendlyError } from "../../lib/data";
import type { Receipt } from "../../lib/documents";
import { dateFmt, money } from "../../utils/formatters";

export function ReceiptModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true; getReceipt(orderId).then(r => alive && setReceipt(r)).catch(e => alive && setError(friendlyError(e, "We couldn’t load this receipt."))); return () => { alive = false; }; }, [orderId]);
  const paid = receipt?.payment_status === "PAID";
  return (
    <PrintModal title={receipt ? `Receipt ${receipt.reference}` : "Receipt"} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      {!receipt && !error && <p className="muted" style={{ padding: 24 }}>Preparing your receipt…</p>}
      {receipt && (
        <article className="receipt-sheet" aria-label="Official receipt">
          <header className="receipt-head">
            <span className="brand-mark"><Droplets /></span>
            <h2>{receipt.station.name}</h2>
            <p>{receipt.station.address}</p>
            <p>{receipt.station.phone} · {receipt.station.email}</p>
            <p>TIN {receipt.station.tin}</p>
          </header>
          <div className="receipt-title"><span>OFFICIAL RECEIPT</span><span className={`receipt-stamp ${paid ? "paid" : "unpaid"}`}>{paid ? "PAID" : "UNPAID"}</span></div>
          <dl className="receipt-meta">
            <div><dt>Receipt no.</dt><dd>{receipt.reference}</dd></div>
            <div><dt>Date</dt><dd>{dateFmt(receipt.completed_at || receipt.order_created_at)}</dd></div>
            <div><dt>Customer</dt><dd>{receipt.customer_name}</dd></div>
            <div><dt>Order type</dt><dd>{receipt.fulfillment === "Delivery" ? "Home delivery" : "Station pickup"}</dd></div>
            {receipt.fulfillment === "Delivery" && receipt.address && <div className="wide"><dt>Deliver to</dt><dd>{receipt.address}</dd></div>}
            {receipt.rider_name && <div><dt>Rider</dt><dd>{receipt.rider_name}</dd></div>}
            <div><dt>Payment</dt><dd>{receipt.payment_method}</dd></div>
          </dl>
          <table className="receipt-table">
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
            <tbody>{receipt.lines.map((l, i) => <tr key={i}><td>{l.name}</td><td className="num">{l.quantity}</td><td className="num">{money(l.unit_price)}</td><td className="num">{money(l.subtotal)}</td></tr>)}</tbody>
          </table>
          <div className="receipt-totals">
            <div><span>Items</span><b>{receipt.lines.reduce((n, l) => n + l.quantity, 0)}</b></div>
            <div className="grand"><span>TOTAL</span><b>{money(receipt.total)}</b></div>
            <div><span>Amount paid</span><b>{money(receipt.amount_paid)}</b></div>
            <div><span>Balance due</span><b>{money(receipt.balance)}</b></div>
          </div>
          {paid && receipt.paid_at && <p className="receipt-note">Payment received {dateFmt(receipt.paid_at)}.</p>}
          <footer className="receipt-foot"><p>{receipt.station.receiptFooter}</p><small>Printed {dateFmt(receipt.issued_at)}</small></footer>
        </article>
      )}
    </PrintModal>
  );
}
