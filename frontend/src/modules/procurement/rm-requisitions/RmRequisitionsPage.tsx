import { useEffect, useState } from 'react';
import { Plus, Printer, Search, FileText, CheckCircle2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';
import { statusBadge } from '../../../components/ui/Badge';

interface Product { id: string; sku: string; name: string; type: string; }
interface UOM { id: string; code: string; name: string; }
interface Partner { id: string; name: string; partnerType: string; }

interface ReqLine { productId: string; uomId: string; requestedQty: string; unitPrice: string; }
interface Requisition {
  id: string; number: string; status: string; requestedOn: string; salesOrderRef?: string;
  supplier?: { name: string } | null;
  lines: Array<{ id: string; product?: Product; uom?: UOM; requestedQty: number; receivedQty: number; unitPrice?: number; }>;
  totalEstimatedCost?: number;
}

export function RmRequisitionsPage() {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [form, setForm] = useState({ salesOrderRef: '', supplierId: '' });
  const [lines, setLines] = useState<ReqLine[]>([{ productId: '', uomId: '', requestedQty: '', unitPrice: '' }]);

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [reqs, prods, uomData, partnerData] = await Promise.all([
        api<{ data: Requisition[] }>('/purchase-requisitions'),
        api<{ data: Product[] }>('/products'),
        api<{ data: UOM[] }>('/uoms'),
        api<{ data: Partner[] }>('/partners'),
      ]);
      setRows(reqs.data);
      setProducts(prods.data.filter((p) => p.type === 'RAW_MATERIAL'));
      setUoms(uomData.data);
      setPartners(partnerData.data.filter((p) => p.partnerType === 'SUPPLIER'));
      setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      const validLines = lines.filter((l) => l.productId && l.uomId && l.requestedQty);
      if (validLines.length === 0) return setMessage('Add at least one product line.');
      await api('/purchase-requisitions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          supplierId: form.supplierId || undefined,
          lines: validLines.map((l) => ({
            productId: l.productId, uomId: l.uomId,
            requestedQty: Number(l.requestedQty),
            unitPrice: l.unitPrice ? Number(l.unitPrice) : undefined,
          })),
        }),
      });
      setOpen(false);
      setForm({ salesOrderRef: '', supplierId: '' });
      setLines([{ productId: '', uomId: '', requestedQty: '', unitPrice: '' }]);
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const approve = async (id: string) => {
    try {
      await api(`/purchase-requisitions/${id}/approve`, { method: 'POST' });
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const printReq = (req: Requisition) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Requisition ${req.number}</title>
      <style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:10px;text-align:left}th{background:#f5f5f5}.header{display:flex;justify-content:space-between;align-items:flex-start}.badge{background:#e8f8ef;color:#1b8f5a;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700}.footer{margin-top:40px;display:flex;justify-content:space-between;font-size:13px;color:#777}@media print{button{display:none}}</style>
      </head><body>
      <div class="header"><div><h1>RM Purchase Requisition</h1><p>ID: <strong>${req.number}</strong> &nbsp;|&nbsp; Date: ${new Date(req.requestedOn).toLocaleDateString('en-GB')}</p>${req.supplier ? `<p>Supplier: <strong>${req.supplier.name}</strong></p>` : ''}</div><span class="badge">${req.status}</span></div>
      ${req.salesOrderRef ? `<p>Sales Order Ref: <strong>${req.salesOrderRef}</strong></p>` : ''}
      <table><thead><tr><th>#</th><th>Product</th><th>Requested Qty</th><th>Received Qty</th><th>UOM</th><th>Unit Price</th></tr></thead>
      <tbody>${req.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.product?.name ?? ''}<br><small>${l.product?.sku ?? ''}</small></td><td>${Number(l.requestedQty).toLocaleString()}</td><td>${Number(l.receivedQty).toLocaleString()}</td><td>${l.uom?.code ?? ''}</td><td>${l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>`).join('')}</tbody></table>
      <div class="footer"><span>Prepared by: _______________________</span><span>Approved by: _______________________</span><span>Date: _____________</span></div>
      <script>setTimeout(()=>window.print(),300)</script></body></html>
    `);
    w.document.close();
  };

  const filtered = rows.filter((r) =>
    r.number.toLowerCase().includes(search.toLowerCase()) ||
    (r.supplier?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="page-container">
      <PageHeader
        cap="RM PROCUREMENT"
        title="Purchase Requisitions"
        description="Create RM requisitions from sales demand. Each gets a unique auto-generated ID and is downloadable as a formal report."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> New Requisition
          </Button>
        }
      />

      {message && <Notice variant="error">{message}</Notice>}

      {/* Stats row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total', value: rows.length, color: 'brand' },
          { label: 'Submitted', value: rows.filter((r) => r.status === 'SUBMITTED').length, color: 'blue' },
          { label: 'Approved', value: rows.filter((r) => r.status === 'APPROVED').length, color: 'green' },
          { label: 'Received', value: rows.filter((r) => r.status === 'RECEIVED' || r.status === 'PARTIALLY_RECEIVED').length, color: 'purple' },
        ].map((s) => (
          <div className="stat-card" key={s.label} style={{ padding: '14px 16px' }}>
            <div className="stat-card__body">
              <div className="stat-card__value" style={{ fontSize: 22 }}>{s.value}</div>
              <div className="stat-card__label">{s.label} Requisitions</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header">
          <h2>Requisition Register</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="search-bar">
              <Search size={15} />
              <input
                placeholder="Search by number or supplier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Requisition #</th>
                <th>Supplier</th>
                <th>Sales Ref</th>
                <th>Lines</th>
                <th>Est. Value</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id}>
                  <td><strong style={{ color: 'var(--brand-primary)' }}>{req.number}</strong></td>
                  <td>{req.supplier?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{req.salesOrderRef ?? '—'}</span></td>
                  <td>{req.lines.length} items</td>
                  <td>{req.totalEstimatedCost ? req.totalEstimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                  <td>{statusBadge(req.status)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(req.requestedOn).toLocaleDateString('en-GB')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="secondary" onClick={() => setSelected(req)}>
                        <FileText size={14} /> View
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => printReq(req)}>
                        <Printer size={14} /> Print
                      </Button>
                      {req.status === 'SUBMITTED' && (
                        <Button size="sm" variant="accent" onClick={() => approve(req.id)}>
                          <CheckCircle2 size={14} /> Approve
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon"><FileText size={28} /></div>
              <b>No requisitions found</b>
              <p>Create a new RM requisition from sales demand to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {open && (
        <Modal
          title="New RM Purchase Requisition"
          description="Create a sourcing request for raw materials. A unique requisition ID will be auto-generated."
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={submit}>Submit Requisition</Button>
            </>
          }
        >
          <div className="ui-form-grid">
            <FormField label="Sales Order Reference">
              <Input placeholder="e.g. SO-2026-0012" value={form.salesOrderRef} onChange={(e) => setForm({ ...form, salesOrderRef: e.target.value })} />
            </FormField>
            <FormField label="Preferred Supplier">
              <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">— Select supplier —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>Raw Material Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { productId: '', uomId: '', requestedQty: '', unitPrice: '' }])}>
                <Plus size={14} /> Add Line
              </Button>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="ui-form-grid" style={{ background: 'var(--bg-card-alt)', padding: 12, borderRadius: 10, marginBottom: 10 }}>
                <FormField label="Raw Material Product">
                  <Select value={line.productId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, productId: e.target.value } : l))}>
                    <option value="">— Select product —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </Select>
                </FormField>
                <FormField label="UOM">
                  <Select value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}>
                    <option value="">— UOM —</option>
                    {uoms.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                  </Select>
                </FormField>
                <FormField label="Requested Quantity">
                  <Input type="number" placeholder="e.g. 30000" value={line.requestedQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, requestedQty: e.target.value } : l))} />
                </FormField>
                <FormField label="Unit Price (optional)">
                  <Input type="number" placeholder="Price per UOM" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, unitPrice: e.target.value } : l))} />
                </FormField>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Detail view modal */}
      {selected && (
        <Modal
          title={`Requisition ${selected.number}`}
          description={`Status: ${selected.status} · Supplier: ${selected.supplier?.name ?? 'Not assigned'}`}
          onClose={() => setSelected(null)}
          wide
          footer={
            <>
              <Button variant="secondary" onClick={() => { printReq(selected); }}>
                <Printer size={14} /> Print Report
              </Button>
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </>
          }
        >
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Product</th><th>SKU</th><th>Requested</th><th>Received</th><th>UOM</th><th>Unit Price</th></tr></thead>
              <tbody>
                {selected.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.product?.name ?? '—'}</td>
                    <td><span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.product?.sku ?? '—'}</span></td>
                    <td><strong>{Number(l.requestedQty).toLocaleString()}</strong></td>
                    <td>{Number(l.receivedQty).toLocaleString()}</td>
                    <td>{l.uom?.code ?? '—'}</td>
                    <td>{l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  );
}


