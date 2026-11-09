import React, { useEffect, useMemo, useState } from "react";
import { Building2, FileText, Plus, Receipt, Users } from "lucide-react";
import { addCompanyAffiliation, createCompany, friendlyError, loadCompanyData, loadCompanyStatement, markCompanyBillPaid, saveCompanyBill } from "../../lib/data";
import { money } from "../../utils/formatters";
import { TablePagination, TableToolbar } from "../../components/ui/TableControls";
import { useConfirm, type ConfirmOptions } from "../../components/ui/ConfirmDialog";
import { StatementModal } from "../receipts/StatementModal";
import { Status } from "../../components/ui/Status";

type Props = { action: (fn: () => Promise<any>, success: string, options?: { confirm?: false | ConfirmOptions }) => Promise<boolean> | void; busy: boolean; role: string };
const includes = (vals: any[], q: string) => vals.some(v => String(v ?? "").toLowerCase().includes(q.toLowerCase()));
function usePaged<T>(rows: T[]) { const [rowsPer, setRowsPer] = useState(10); const [page, setPage] = useState(1); useEffect(() => setPage(1), [rows.length, rowsPer]); const pageCount = Math.max(1, Math.ceil(rows.length / rowsPer)); return { rowsPer, setRowsPer, page, setPage, pageCount, visible: rows.slice((page - 1) * rowsPer, page * rowsPer), start: rows.length ? (page - 1) * rowsPer + 1 : 0, end: Math.min(page * rowsPer, rows.length) }; }

export function CompaniesPanel({ action, busy, role }: Props) {
  const { prompt } = useConfirm();
  const [data, setData] = useState<{ companies: any[]; customers: any[]; affiliations: any[]; bills: any[] }>({ companies: [], customers: [], affiliations: [], bills: [] });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [name, setName] = useState(""); const [focal, setFocal] = useState(""); const [contact, setContact] = useState("");
  const [customerId, setCustomerId] = useState(""); const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [preview, setPreview] = useState<{ amount: number; count: number } | null>(null); const [calculating, setCalculating] = useState(false);
  const [statement, setStatement] = useState<{ companyId: number; period: string } | null>(null);
  const [cq, setCq] = useState(""); const [aq, setAq] = useState(""); const [bq, setBq] = useState("");

  const assigned = useMemo(() => new Set(data.affiliations.filter(a => a.active).map(a => a.customer_id)), [data.affiliations]);
  const available = useMemo(() => data.customers.filter(c => !assigned.has(c.id)), [data.customers, assigned]);
  const companies = useMemo(() => data.companies.filter(c => includes([c.name, c.focal_person_name, c.contact_information], cq)), [data.companies, cq]);
  const affs = useMemo(() => data.affiliations.filter(a => includes([a.profiles?.full_name, a.profiles?.email, a.companies?.name, a.active ? "active" : "inactive"], aq)), [data.affiliations, aq]);
  const bills = useMemo(() => data.bills.filter(b => includes([b.companies?.name, b.billing_period, b.status], bq)), [data.bills, bq]);
  const pc = usePaged(companies), pa = usePaged(affs), pb = usePaged(bills);

  async function refresh() {
    setError("");
    try {
      const d = await loadCompanyData(); setData(d as any);
      if (!companyId && d.companies[0]) setCompanyId(String(d.companies[0].id));
      if (!customerId) { const free = d.customers.find((c: any) => !d.affiliations.some((a: any) => a.active && a.customer_id === c.id)); if (free) setCustomerId(free.id); }
    } catch (e) { setError(friendlyError(e, "We couldn’t load company records.")); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    let alive = true; setPreview(null); if (!companyId || !period) return; setCalculating(true);
    loadCompanyStatement(Number(companyId), period).then(s => { if (alive) setPreview({ amount: s.subtotal, count: s.orders.length }); }).catch(() => alive && setPreview(null)).finally(() => alive && setCalculating(false));
    return () => { alive = false; };
  }, [companyId, period, data.affiliations, data.bills]);

  const existing = data.bills.find(b => String(b.company_id) === companyId && String(b.billing_period).slice(0, 7) === period);

  async function payBill(bill: any) {
    const reference = await prompt({ title: "Record company payment?", message: <>Mark the <strong>{String(bill.billing_period).slice(0, 7)}</strong> bill for <strong>{bill.companies?.name || "this company"}</strong> as fully paid ({money(Number(bill.amount_due))}).</>, input: { label: "Payment reference number", placeholder: "e.g. OR-2026-0142 (optional)", required: false }, confirmLabel: "Mark as paid" });
    if (reference === null) return;
    await action(async () => { await markCompanyBillPaid(bill.id, reference || null, Number(bill.amount_due)); await refresh(); }, "Company payment recorded.", { confirm: false });
  }

  if (loading) return <section className="panel"><p className="muted" style={{ padding: 20 }}>Loading companies…</p></section>;
  return (
    <div className="stack-lg">
      {error && <div className="alert error" role="alert">{error}</div>}
      <section className="panel">
        <div className="panel-heading"><div><h2><Building2 size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Companies</h2><p>Corporate accounts that are billed once a month.</p></div></div>
        {role === "admin" && <form className="form-grid company-form company-form--company" onSubmit={e => { e.preventDefault(); void action(async () => { if (!name.trim() || !focal.trim()) throw new Error("Company name and contact person are required."); await createCompany({ name: name.trim(), focal_person_name: focal.trim(), contact_information: contact.trim() || null }); setName(""); setFocal(""); setContact(""); await refresh(); }, "Company added.", { confirm: { title: "Add this company?", message: `Create “${name.trim() || "this company"}” as a billed company account.`, confirmLabel: "Add company" } }); }}>
          <label>Company name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ABC Manufacturing" required /></label>
          <label>Contact person<input value={focal} onChange={e => setFocal(e.target.value)} placeholder="Who receives the bill" required /></label>
          <label>Phone or email<input value={contact} onChange={e => setContact(e.target.value)} placeholder="Optional" /></label>
          <div className="form-actions"><button className="btn primary" disabled={busy}><Plus size={16} /> Add company</button></div></form>}
        <TableToolbar query={cq} onQueryChange={setCq} placeholder="Search companies…" label="Search companies" rowsPerPage={pc.rowsPer} onRowsPerPageChange={pc.setRowsPer} resultCount={companies.length} />
        <div className="table-wrap"><table><thead><tr><th>Company</th><th>Contact person</th><th>Contact</th><th>Staff accounts</th></tr></thead><tbody>
          {pc.visible.map(c => <tr key={c.id}><td data-label="Company"><strong>{c.name}</strong></td><td data-label="Contact person">{c.focal_person_name}</td><td data-label="Contact">{c.contact_information || "—"}</td><td data-label="Staff accounts">{data.affiliations.filter(a => a.company_id === c.id && a.active).length}</td></tr>)}</tbody></table>
          {!companies.length && <p className="muted" style={{ padding: 16 }}>No companies yet.</p>}</div>
        <TablePagination page={pc.page} pageCount={pc.pageCount} onPageChange={pc.setPage} start={pc.start} end={pc.end} total={companies.length} />
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2><Users size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Customer assignment</h2><p>A customer can belong to one company at a time. Their completed orders are included in that company’s monthly statement.</p></div></div>
        {role === "admin" && <form className="form-grid company-form company-form--affiliation" onSubmit={e => { e.preventDefault(); void action(async () => { if (!customerId || !companyId) throw new Error("Choose a customer and a company."); await addCompanyAffiliation(customerId, Number(companyId)); setCustomerId(""); await refresh(); }, "Customer assigned to company.", { confirm: { title: "Assign customer to company?", message: "Future monthly statements for this company will include this customer’s completed orders.", confirmLabel: "Assign" } }); }}>
          <label>Customer<select value={customerId} onChange={e => setCustomerId(e.target.value)} required><option value="">Select customer…</option>{available.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></label>
          <label>Company<select value={companyId} onChange={e => setCompanyId(e.target.value)} required><option value="">Select company…</option>{data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div className="form-actions"><button className="btn primary" disabled={busy || !data.companies.length || !available.length}><Plus size={16} /> Assign customer</button></div></form>}
        <TableToolbar query={aq} onQueryChange={setAq} placeholder="Search customer or company…" label="Search assignments" rowsPerPage={pa.rowsPer} onRowsPerPageChange={pa.setRowsPer} resultCount={affs.length} />
        <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Company</th><th>Status</th></tr></thead><tbody>
          {pa.visible.map(a => <tr key={a.id}><td data-label="Customer">{a.profiles?.full_name || a.profiles?.email}</td><td data-label="Company">{a.companies?.name}</td><td data-label="Status"><span className={`status ${a.active ? "success" : "muted"}`}>{a.active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table>
          {!affs.length && <p className="muted" style={{ padding: 16 }}>No customers are assigned to a company yet.</p>}</div>
        <TablePagination page={pa.page} pageCount={pa.pageCount} onPageChange={pa.setPage} start={pa.start} end={pa.end} total={affs.length} />
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2><Receipt size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Monthly billing statements</h2><p>Builds one consolidated statement of account per company and month from all completed orders, with every invoice itemised.</p></div></div>
        <div className="form-grid company-form company-form--billing">
          <label>Company<select value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">Select company…</option>{data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Billing month<input type="month" value={period} onChange={e => setPeriod(e.target.value)} /></label>
          <label>Amount for this month (₱)<input readOnly value={calculating ? "Calculating…" : preview ? preview.amount.toFixed(2) : ""} placeholder="—" /></label>
          <p className="muted">{calculating ? "Adding up completed orders…" : preview ? `${preview.count} completed order(s) included.` : "Choose a company to preview its statement."}</p>
          <div className="form-actions">
            <button className="btn secondary" disabled={!companyId || !period} onClick={() => setStatement({ companyId: Number(companyId), period })}><FileText size={16} /> View / print statement</button>
            {role === "admin" && <button className="btn primary" disabled={busy || calculating || !preview || !companyId} onClick={() => action(async () => { await saveCompanyBill(Number(companyId), period); await refresh(); }, "Monthly bill saved.", { confirm: { title: existing ? "Update this bill?" : "Create this bill?", message: `${existing ? "Refresh" : "Save"} the ${period} bill for ${data.companies.find(c => String(c.id) === companyId)?.name || "this company"}: ${money(preview?.amount || 0)}.`, confirmLabel: existing ? "Update bill" : "Create bill" } })}><Plus size={16} /> {existing ? "Update bill" : "Save bill"}</button>}
          </div>
        </div>
        <TableToolbar query={bq} onQueryChange={setBq} placeholder="Search bills…" label="Search bills" rowsPerPage={pb.rowsPer} onRowsPerPageChange={pb.setRowsPer} resultCount={bills.length} />
        <div className="table-wrap"><table><thead><tr><th>Company</th><th>Month</th><th>Amount due</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {pb.visible.map(b => <tr key={b.id}><td data-label="Company"><strong>{b.companies?.name}</strong></td><td data-label="Month">{String(b.billing_period).slice(0, 7)}</td><td data-label="Amount due" className="money">{money(b.amount_due)}</td><td data-label="Paid" className="money">{money(b.amount_paid)}</td>
            <td data-label="Status"><Status status={b.status === "PAID" ? "PAID" : "PENDING"} kind="payment" /></td>
            <td data-label="Actions"><div className="row-actions">
              <button className="btn small secondary" onClick={() => setStatement({ companyId: b.company_id, period: String(b.billing_period).slice(0, 7) })}><FileText size={14} /> Statement</button>
              {role === "admin" && b.status !== "PAID" && b.status !== "VOID" && <button className="btn small primary" disabled={busy} onClick={() => void payBill(b)}>Mark paid</button>}</div></td></tr>)}</tbody></table>
          {!bills.length && <p className="muted" style={{ padding: 16 }}>No bills saved yet.</p>}</div>
        <TablePagination page={pb.page} pageCount={pb.pageCount} onPageChange={pb.setPage} start={pb.start} end={pb.end} total={bills.length} />
      </section>
      {statement && <StatementModal companyId={statement.companyId} period={statement.period} onClose={() => setStatement(null)} />}
    </div>
  );
}
