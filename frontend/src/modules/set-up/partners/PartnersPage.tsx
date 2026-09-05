import { useEffect, useState } from 'react';
import { Plus, Building2, Search, Phone, Mail } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';

interface Partner {
  id: string; name: string; code: string; partnerType: string;
  email?: string; phone?: string; address?: string; contactPerson?: string;
}

export function PartnersPage() {
  const [rows, setRows] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SUPPLIER' | 'CUSTOMER'>('ALL');
  const [form, setForm] = useState({ name: '', code: '', partnerType: 'SUPPLIER', email: '', phone: '', address: '', contactPerson: '' });

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try { const r = await api<{ data: Partner[] }>('/partners'); setRows(r.data); setMessage(''); }
    catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      await api('/partners', { method: 'POST', body: JSON.stringify(form) });
      setOpen(false); setForm({ name: '', code: '', partnerType: 'SUPPLIER', email: '', phone: '', address: '', contactPerson: '' }); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const filtered = rows.filter((r) =>
    (typeFilter === 'ALL' || r.partnerType === typeFilter) &&
    (r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.email ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const suppliers = rows.filter((r) => r.partnerType === 'SUPPLIER');
  const customers = rows.filter((r) => r.partnerType === 'CUSTOMER');

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Suppliers & Customers"
      description="Manage your partner directory — suppliers who provide raw materials and customers who receive finished goods."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Add Partner</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Partners', v: rows.length, color: 'brand' },
          { label: 'Suppliers', v: suppliers.length, color: 'blue' },
          { label: 'Customers', v: customers.length, color: 'green' },
        ].map((s) => (
          <div className="stat-card" key={s.label} style={{ padding: '14px 16px' }}>
            <div className="stat-card__body"><div className="stat-card__value" style={{ fontSize: 22 }}>{s.v}</div><div className="stat-card__label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <Card padding="none">
        <div className="table-header">
          <h2>Partner Directory</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="tabs" style={{ border: 'none', margin: 0 }}>
              {(['ALL', 'SUPPLIER', 'CUSTOMER'] as const).map((t) => (
                <button key={t} className={`tab ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>{t === 'ALL' ? 'All' : t === 'SUPPLIER' ? 'Suppliers' : 'Customers'}</button>
              ))}
            </div>
            <div className="search-bar"><Search size={14} /><input placeholder="Search partners…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Partner Name</th><th>Code</th><th>Type</th><th>Contact Person</th><th>Email</th><th>Phone</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: p.partnerType === 'SUPPLIER' ? 'var(--info-bg)' : 'var(--success-bg)', display: 'grid', placeItems: 'center', color: p.partnerType === 'SUPPLIER' ? 'var(--info)' : 'var(--success)', flexShrink: 0 }}>
                        <Building2 size={14} />
                      </div>
                      <strong>{p.name}</strong>
                    </div>
                  </td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.code}</span></td>
                  <td>
                    {p.partnerType === 'SUPPLIER'
                      ? <span className="badge badge--blue"><span className="badge__dot" />Supplier</span>
                      : <span className="badge badge--green"><span className="badge__dot" />Customer</span>}
                  </td>
                  <td>{p.contactPerson ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td>{p.email ? <a href={`mailto:${p.email}`} style={{ color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{p.email}</a> : '—'}</td>
                  <td>{p.phone ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><Phone size={12} />{p.phone}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Building2 size={28} /></div><b>No partners found</b><p>Add suppliers who provide raw materials and customers who receive finished goods.</p></div>}
        </div>
      </Card>

      {open && (
        <Modal title="Add Partner" description="Register a new supplier or customer in the partner directory." wide onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.name || !form.code}>Save Partner</Button></>}
        >
          <div className="form-grid-2">
            <FormField label="Partner Type" required>
              <Select value={form.partnerType} onChange={(e) => setForm({ ...form, partnerType: e.target.value })}>
                <option value="SUPPLIER">Supplier (RM vendor)</option>
                <option value="CUSTOMER">Customer (FG buyer)</option>
              </Select>
            </FormField>
            <FormField label="Partner Code" required hint="Short unique identifier">
              <Input placeholder="e.g. AGRO-BD-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>
            <FormField label="Company Name" required>
              <Input placeholder="Full legal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Contact Person">
              <Input placeholder="Primary contact" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <Input type="email" placeholder="contact@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
            <FormField label="Phone">
              <Input placeholder="+880…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Address">
            <Input placeholder="Factory address / Street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormField>
        </Modal>
      )}
    </PageContainer>
  );
}
