import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Users, Receipt } from 'lucide-react';
import { requireSupabase } from '../../lib/supabase';
import { money } from '../../utils/formatters';
import { TablePagination, TableToolbar } from '../../components/ui/TableControls';
import { useConfirm, type ConfirmOptions } from '../../components/ui/ConfirmDialog';

export function CompaniesPanel({ action, busy, role }: { action: (fn: () => Promise<any>, success: string, options?: { confirm?: false | ConfirmOptions }) => Promise<boolean> | void; busy: boolean; role: string }) {
  const { prompt } = useConfirm();
  const [companies, setCompanies] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [affiliations, setAffiliations] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [focal, setFocal] = useState('');
  const [contact, setContact] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState<number | null>(null);
  const [billingOrderCount, setBillingOrderCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyRows, setCompanyRows] = useState(10);
  const [companyPage, setCompanyPage] = useState(1);
  const [affiliationQuery, setAffiliationQuery] = useState('');
  const [affiliationRows, setAffiliationRows] = useState(10);
  const [affiliationPage, setAffiliationPage] = useState(1);
  const [billQuery, setBillQuery] = useState('');
  const [billRows, setBillRows] = useState(10);
  const [billPage, setBillPage] = useState(1);

  const assignedCustomerIds = useMemo(() => new Set(affiliations.filter(a => a.active).map(a => a.customer_id)), [affiliations]);
  const availableCustomers = useMemo(() => customers.filter(c => !assignedCustomerIds.has(c.id) || c.id === customerId), [customers, assignedCustomerIds, customerId]);
  const filteredCompanies = useMemo(() => companies.filter(c => [c.name, c.focal_person_name, c.contact_information, c.active === false ? 'inactive' : 'active'].some(v => String(v ?? '').toLowerCase().includes(companyQuery.toLowerCase()))), [companies, companyQuery]);
  const visibleCompanies = filteredCompanies.slice((companyPage - 1) * companyRows, companyPage * companyRows);
  const filteredAffiliations = useMemo(() => affiliations.filter(a => [a.profiles?.full_name, a.profiles?.email, a.customer_id, a.companies?.name, a.affiliation_type, a.active ? 'active' : 'inactive'].some(v => String(v ?? '').toLowerCase().includes(affiliationQuery.toLowerCase()))), [affiliations, affiliationQuery]);
  const visibleAffiliations = filteredAffiliations.slice((affiliationPage - 1) * affiliationRows, affiliationPage * affiliationRows);
  const filteredBills = useMemo(() => bills.filter(b => [b.companies?.name, b.billing_period, b.amount_due, b.amount_paid, b.status].some(v => String(v ?? '').toLowerCase().includes(billQuery.toLowerCase()))), [bills, billQuery]);
  const visibleBills = filteredBills.slice((billPage - 1) * billRows, billPage * billRows);
  useEffect(() => setCompanyPage(1), [companyQuery, companyRows]);
  useEffect(() => setAffiliationPage(1), [affiliationQuery, affiliationRows]);
  useEffect(() => setBillPage(1), [billQuery, billRows]);

  async function refresh() {
    setLoading(true); setError('');
    try {
      const db = requireSupabase();
      const [co, cu, af, bi] = await Promise.all([
        db.from('companies').select('*').order('name'),
        db.from('profiles').select('id,full_name,email').eq('role','customer').order('full_name'),
        db.from('customer_company_affiliations').select('id,customer_id,company_id,affiliation_type,active,profiles!customer_company_affiliations_customer_id_fkey(full_name,email),companies!customer_company_affiliations_company_id_fkey(name)').order('created_at',{ascending:false}),
        db.from('company_billing_records').select('id,company_id,billing_period,amount_due,amount_paid,status,companies!company_billing_records_company_id_fkey(name)').order('billing_period',{ascending:false}).limit(100),
      ]);
      for (const r of [co,cu,af,bi]) if (r.error) throw r.error;
      setCompanies(co.data || []); setCustomers(cu.data || []); setAffiliations(af.data || []); setBills(bi.data || []);
      if (!companyId && co.data?.[0]) setCompanyId(String(co.data[0].id));
      if (!customerId && cu.data?.[0]) setCustomerId(cu.data[0].id);
    } catch (e: any) { setError(e.message || 'Could not load company records. Apply the company-affiliation migration and verify RLS policies.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function calculateBill() {
    setAmount(null); setBillingOrderCount(0);
    if (!companyId || !period) return;
    setCalculating(true); setError('');
    try {
      const db = requireSupabase();
      const customerIds = affiliations.filter(a => a.active && String(a.company_id) === companyId).map(a => a.customer_id);
      if (!customerIds.length) { setAmount(0); return; }
      // Billing month boundaries in Philippine time (UTC+8), expressed as UTC instants.
      const [year, month] = period.split('-').map(Number) as [number, number];
      const pad = (n: number) => String(n).padStart(2, '0');
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      const start = new Date(`${year}-${pad(month)}-01T00:00:00+08:00`).toISOString();
      const end = new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00+08:00`).toISOString();
      // An order belongs to the month it was completed in (orders.completed_at is set by a trigger when
      // the status becomes DELIVERED or PICKED UP; see migration 202610200003).
      const { data, error: queryError } = await db.from('orders')
        .select('id,total,status,completed_at,customer_id')
        .in('customer_id', customerIds)
        .in('status', ['DELIVERED', 'PICKED UP'])
        .gte('completed_at', start)
        .lt('completed_at', end);
      if (queryError) throw queryError;
      const orders = data || [];
      setAmount(orders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0));
      setBillingOrderCount(orders.length);
    } catch (e: any) {
      setAmount(null);
      setError(e.message || 'Could not calculate completed orders for this billing period. Make sure the company billing migration has been applied.');
    } finally { setCalculating(false); }
  }
  useEffect(() => { void calculateBill(); }, [companyId, period, affiliations]);

  async function createCompany() {
    if (!name.trim() || !focal.trim()) throw new Error('Company name and focal person are required.');
    const { error } = await requireSupabase().from('companies').insert({ name: name.trim(), focal_person_name: focal.trim(), contact_information: contact.trim() || null }).select().single();
    if (error) throw error; setName(''); setFocal(''); setContact(''); await refresh();
  }
  async function addAffiliation() {
    if (!customerId || !companyId) throw new Error('Choose a customer and company.');
    if (affiliations.some(a => a.active && a.customer_id === customerId && String(a.company_id) !== companyId)) throw new Error('This customer is already assigned to another company. Deactivate the existing affiliation before assigning a new company.');
    const { error } = await requireSupabase().from('customer_company_affiliations').upsert({ customer_id: customerId, company_id: Number(companyId), affiliation_type: 'Member', active: true }, { onConflict: 'customer_id,company_id' });
    if (error) throw error; await refresh();
  }
  async function createBill() {
    if (!companyId || !period || amount === null || calculating || amount < 0) throw new Error('The bill cannot be created until the completed-order total has been calculated.');
    const billingPeriod = `${period}-01`;
    const existing = bills.find(b => String(b.company_id) === companyId && String(b.billing_period).slice(0, 7) === period);
    if (existing) {
      if (existing.status === 'VOID') throw new Error('This month\'s bill was voided and cannot be recalculated.');
      // Keep whatever the company already paid; only the amount due is refreshed. If new orders
      // came in after a payment, the bill becomes PARTIALLY_PAID / UNPAID again for the balance.
      const paid = Number(existing.amount_paid) || 0;
      if (amount < paid) throw new Error(`The company already paid ${money(paid)}, which is more than the calculated total of ${money(amount)}. The bill cannot be lowered below the amount paid.`);
      if (amount === Number(existing.amount_due)) throw new Error('This bill is already up to date: no new completed orders since it was last calculated.');
      const status = paid >= amount ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
      const { error } = await requireSupabase().from('company_billing_records').update({ amount_due: amount, status, notes: `Recalculated from ${billingOrderCount} completed orders.` }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await requireSupabase().from('company_billing_records').insert({ company_id: Number(companyId), billing_period: billingPeriod, amount_due: amount, amount_paid: 0, status: amount === 0 ? 'PAID' : 'UNPAID', notes: `Automatically calculated from ${billingOrderCount} completed orders.` });
      if (error) throw error;
    }
    await refresh();
  }
  // Asks for the payment reference in an in-app dialog (replaces the browser prompt) and records the payment.
  async function requestMarkBillPaid(bill: any) {
    const reference = await prompt({
      title: 'Record company payment?',
      message: <>Mark the <strong>{String(bill.billing_period).slice(0, 7)}</strong> bill for <strong>{bill.companies?.name || 'this company'}</strong> as fully paid ({money(Number(bill.amount_due))}).</>,
      input: { label: 'Payment reference number', placeholder: 'e.g. OR-2026-0142 (optional)', required: false },
      confirmLabel: 'Mark as paid',
    });
    if (reference === null) return; // cancelled
    await action(() => markBillPaid(bill, reference || null), 'Company monthly payment recorded.', { confirm: false });
  }
  async function markBillPaid(bill: any, reference: string | null) {
    const { error } = await requireSupabase().from('company_billing_records').update({ amount_paid: bill.amount_due, status: 'PAID', payment_reference: reference }).eq('id', bill.id);
    if (error) throw error; await refresh();
  }
  return <div className="stack-lg">
    <section className="panel">
      <div className="panel-heading"><div><h2><Building2 size={20} style={{verticalAlign:'middle',marginRight:8}}/>Companies & affiliations</h2><p>Each customer can be actively assigned to one company only.</p></div></div>
      {error && <div className="alert info">{error}</div>}
      {role === 'admin' && <form className="form-grid company-form company-form--company" onSubmit={e => { e.preventDefault(); action(createCompany, 'Company created.', { confirm: { title: 'Add this company?', message: `Create “${name.trim() || 'new company'}” with ${focal.trim() || 'the given focal person'} as contact person.`, confirmLabel: 'Add company' } }); }}>
        <label>Company / organization name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. ABC Manufacturing" required/></label>
        <label>Company focal person<input value={focal} onChange={e=>setFocal(e.target.value)} placeholder="Primary contact person" required/></label>
        <label>Contact information<input value={contact} onChange={e=>setContact(e.target.value)} placeholder="Phone or email (optional)"/></label>
        <div className="form-actions"><button className="btn primary" type="submit" disabled={busy}><Plus size={16}/> Add company</button></div>
      </form>}
      <TableToolbar query={companyQuery} onQueryChange={setCompanyQuery} placeholder="Search companies, focal people, or contact details…" label="Search companies" rowsPerPage={companyRows} onRowsPerPageChange={setCompanyRows} resultCount={filteredCompanies.length} />
      <div className="table-wrap"><table><thead><tr><th>Company</th><th>Focal person</th><th>Contact</th><th>Status</th></tr></thead><tbody>{visibleCompanies.map(c=><tr key={c.id}><td data-label="Company"><strong>{c.name}</strong></td><td data-label="Focal person">{c.focal_person_name || '—'}</td><td data-label="Contact">{c.contact_information || '—'}</td><td data-label="Status">{c.active === false ? 'Inactive' : 'Active'}</td></tr>)}</tbody></table>{!loading && !filteredCompanies.length && <p className="muted">No companies match this search.</p>}</div>
      <TablePagination page={companyPage} pageCount={Math.max(1, Math.ceil(filteredCompanies.length / companyRows))} onPageChange={setCompanyPage} start={filteredCompanies.length ? (companyPage - 1) * companyRows + 1 : 0} end={Math.min(companyPage * companyRows, filteredCompanies.length)} total={filteredCompanies.length} />
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2><Users size={20} style={{verticalAlign:'middle',marginRight:8}}/>Customer company assignment</h2><p>A customer may have only one active company assignment.</p></div></div>
      {role === 'admin' && <form className="form-grid company-form company-form--affiliation" onSubmit={e=>{e.preventDefault();action(addAffiliation,'Customer assigned to company.', { confirm: { title: 'Assign customer to company?', message: `${customers.find(c => c.id === customerId)?.full_name || 'This customer'} will be affiliated with ${companies.find(c => String(c.id) === companyId)?.name || 'the selected company'} and billed monthly under it.`, confirmLabel: 'Assign customer' } })}}>
        <label>Unassigned customer<select value={customerId} onChange={e=>setCustomerId(e.target.value)} required><option value="">Select customer…</option>{availableCustomers.map(c=><option key={c.id} value={c.id}>{c.full_name || c.email || c.id}</option>)}</select></label>
        <label>Company<select value={companyId} onChange={e=>setCompanyId(e.target.value)} required><option value="">Select company…</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="form-actions"><button className="btn primary" type="submit" disabled={busy || !companies.length || !availableCustomers.length}><Plus size={16}/> Assign customer</button></div>
      </form>}
      <TableToolbar query={affiliationQuery} onQueryChange={setAffiliationQuery} placeholder="Search customer, company, affiliation, or status…" label="Search affiliations" rowsPerPage={affiliationRows} onRowsPerPageChange={setAffiliationRows} resultCount={filteredAffiliations.length} />
      <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Company</th><th>Affiliation</th><th>Status</th></tr></thead><tbody>{visibleAffiliations.map(a=><tr key={a.id}><td data-label="Customer">{a.profiles?.full_name || a.profiles?.email || a.customer_id}</td><td data-label="Company">{a.companies?.name || '—'}</td><td data-label="Affiliation">{a.affiliation_type || 'Member'}</td><td data-label="Status">{a.active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table>{!filteredAffiliations.length && <p className="muted">No affiliations match this search.</p>}</div>
      <TablePagination page={affiliationPage} pageCount={Math.max(1, Math.ceil(filteredAffiliations.length / affiliationRows))} onPageChange={setAffiliationPage} start={filteredAffiliations.length ? (affiliationPage - 1) * affiliationRows + 1 : 0} end={Math.min(affiliationPage * affiliationRows, filteredAffiliations.length)} total={filteredAffiliations.length} />
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2><Receipt size={20} style={{verticalAlign:'middle',marginRight:8}}/>Monthly company billing</h2><p>Automatically totals completed deliveries and pickups for the selected company and month.</p></div></div>
      {role === 'admin' && <form className="form-grid company-form company-form--billing" onSubmit={e=>{e.preventDefault();action(createBill,'Monthly bill saved from completed orders.', { confirm: { title: bills.some(b => String(b.company_id) === companyId && String(b.billing_period).slice(0, 7) === period) ? 'Update monthly bill?' : 'Create monthly bill?', message: `Save a ${money(amount ?? 0)} bill (any amount already paid is kept and only the balance stays due) for ${companies.find(c => String(c.id) === companyId)?.name || 'the selected company'} (${period}), based on ${billingOrderCount} completed order(s).`, confirmLabel: 'Create bill' } });}}>
        <label>Company<select value={companyId} onChange={e=>setCompanyId(e.target.value)} required><option value="">Select company…</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Billing month<input type="month" value={period} onChange={e=>setPeriod(e.target.value)} required/></label>
        <label>Calculated amount due (₱)<input type="number" min="0" step="0.01" value={amount === null ? '' : amount.toFixed(2)} placeholder={calculating ? 'Calculating…' : 'Unable to calculate'} readOnly required/></label>
        <p className="muted">{calculating ? 'Calculating completed orders…' : amount === null ? 'Amount unavailable. Check the billing migration and permissions.' : `${billingOrderCount} completed order(s) included. Counts DELIVERED and PICKED UP orders of the company's active members, by the month they were completed (Philippine time).`}</p>
        <div className="form-actions"><button className="btn primary" type="submit" disabled={busy || calculating || amount === null || !companies.length}><Plus size={16}/> Create monthly bill</button></div>
      </form>}
      <TableToolbar query={billQuery} onQueryChange={setBillQuery} placeholder="Search billing company, period, amount, or status…" label="Search monthly billing" rowsPerPage={billRows} onRowsPerPageChange={setBillRows} resultCount={filteredBills.length} />
      <div className="table-wrap"><table><thead><tr><th>Company</th><th>Period</th><th>Amount due</th><th>Amount paid</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleBills.map(b=><tr key={b.id}><td data-label="Company">{b.companies?.name || '—'}</td><td data-label="Period">{String(b.billing_period).slice(0,7)}</td><td data-label="Amount due">{money(Number(b.amount_due))}</td><td data-label="Amount paid">{money(Number(b.amount_paid))}</td><td data-label="Status">{b.status}</td><td data-label="Action">{b.status !== 'PAID' && b.status !== 'VOID' && <button className="btn small secondary" disabled={busy} onClick={() => { void requestMarkBillPaid(b); }}>Mark paid</button>}</td></tr>)}</tbody></table>{!filteredBills.length && <p className="muted">No billing records match this search.</p>}</div>
      <TablePagination page={billPage} pageCount={Math.max(1, Math.ceil(filteredBills.length / billRows))} onPageChange={setBillPage} start={filteredBills.length ? (billPage - 1) * billRows + 1 : 0} end={Math.min(billPage * billRows, filteredBills.length)} total={filteredBills.length} />
    </section>
  </div>;
}
