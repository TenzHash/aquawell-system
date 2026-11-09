import React, { useEffect, useState } from "react";
import { Droplets } from "lucide-react";
import { PrintModal } from "../../components/ui/PrintModal";
import { loadCompanyStatement, friendlyError } from "../../lib/data";
import type { Statement } from "../../lib/documents";
import { dateFmt, money } from "../../utils/formatters";

/** Consolidated monthly billing statement (summary page + itemised order invoice list) for a company account. */
export function StatementModal({ companyId, period, onClose }: { companyId: number; period: string; onClose: () => void }) {
  const [st, setSt] = useState<Statement | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true; loadCompanyStatement(companyId, period).then(r => alive && setSt(r)).catch(e => alive && setError(friendlyError(e, "We couldn’t build this statement."))); return () => { alive = false; }; }, [companyId, period]);
  return (
    <PrintModal title={st ? `Statement ${st.statement_no}` : "Monthly statement"} onClose={onClose} wide>
      {error && <div className="alert error">{error}</div>}
      {!st && !error && <p className="muted" style={{ padding: 24 }}>Preparing the statement…</p>}
      {st && (
        <article className="receipt-sheet statement-sheet" aria-label="Monthly billing statement">
          <header className="statement-head">
            <div className="statement-brand"><span className="brand-mark"><Droplets /></span>
              <div><h2>{st.station.name}</h2><p>{st.station.address}</p><p>{st.station.phone} · {st.station.email} · TIN {st.station.tin}</p></div></div>
            <div className="statement-id"><strong>STATEMENT OF ACCOUNT</strong><span>{st.statement_no}</span><span>Issued {dateFmt(st.issued_at)}</span></div>
          </header>
          <section className="statement-bill">
            <div><small>Bill to</small><strong>{st.company.name}</strong>{st.company.focal_person_name && <span>Attn: {st.company.focal_person_name}</span>}{st.company.contact_information && <span>{st.company.contact_information}</span>}</div>
            <div><small>Billing period</small><strong>{st.period_label}</strong><span>Due {new Date(st.due_date).toLocaleDateString("en-PH", { dateStyle: "long" })}</span><span className={`receipt-stamp ${st.status === "PAID" ? "paid" : "unpaid"}`}>{st.status.replaceAll("_", " ")}</span></div>
          </section>

          <h3 className="statement-h">Summary of items</h3>
          <table className="receipt-table">
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Amount</th></tr></thead>
            <tbody>{st.item_summary.map((l, i) => <tr key={i}><td>{l.name}</td><td className="num">{l.quantity}</td><td className="num">{money(l.unit_price)}</td><td className="num">{money(l.subtotal)}</td></tr>)}
              {!st.item_summary.length && <tr><td colSpan={4} className="muted">No completed orders in this period.</td></tr>}</tbody>
          </table>
          <div className="receipt-totals">
            <div><span>Orders included</span><b>{st.orders.length}</b></div>
            <div><span>Subtotal</span><b>{money(st.subtotal)}</b></div>
            <div><span>Payments received</span><b>{money(st.amount_paid)}</b></div>
            <div className="grand"><span>AMOUNT DUE</span><b>{money(st.amount_due)}</b></div>
          </div>

          <h3 className="statement-h">Itemised invoices</h3>
          <table className="receipt-table statement-orders">
            <thead><tr><th>Invoice</th><th>Date</th><th>Ordered by</th><th>Items</th><th>Payment</th><th className="num">Amount</th></tr></thead>
            <tbody>{st.orders.map(o => (
              <tr key={o.reference}><td><b>{o.reference}</b></td><td>{dateFmt(o.date)}</td><td>{o.customer}</td>
                <td>{o.lines.map(l => `${l.quantity} × ${l.name}`).join("; ")}</td><td>{o.payment_status === "PAID" ? "Paid" : "Unpaid"}</td><td className="num">{money(o.total)}</td></tr>))}
              {!st.orders.length && <tr><td colSpan={6} className="muted">Nothing to bill for this month.</td></tr>}</tbody>
          </table>
          <footer className="receipt-foot"><p>Please settle the amount due by {new Date(st.due_date).toLocaleDateString("en-PH", { dateStyle: "long" })} and quote {st.statement_no}. {st.station.receiptFooter}</p></footer>
        </article>
      )}
    </PrintModal>
  );
}
