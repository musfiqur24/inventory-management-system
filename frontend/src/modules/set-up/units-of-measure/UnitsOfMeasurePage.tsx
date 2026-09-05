import { useEffect, useState } from 'react';
import { Plus, Scale, Search, Trash2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';

interface UOM { id: string; name: string; code: string; decimalPlaces?: number; isBase?: boolean; category?: string; conversionFactor?: number; }

export function UnitsOfMeasurePage() {
  const [rows, setRows] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', category: '', decimalPlaces: '2', conversionFactor: '1' });

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try { const r = await api<{ data: UOM[] }>('/uoms'); setRows(r.data); setMessage(''); }
    catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      await api('/uoms', {
        method: 'POST',
        body: JSON.stringify({ ...form, decimalPlaces: Number(form.decimalPlaces), conversionFactor: Number(form.conversionFactor) }),
      });
      setOpen(false); setForm({ name: '', code: '', category: '', decimalPlaces: '2', conversionFactor: '1' }); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const deleteUom = async (id: string) => {
    if (!window.confirm('Delete this UOM?')) return;
    try { await api(`/uoms/${id}`, { method: 'DELETE' }); void load(); }
    catch (e: any) { setMessage(e.message); }
  };

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))];

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Units of Measure"
      description="Dynamic UOM management. Create mass, volume, or custom units for products, recipes, and transactions."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New UOM</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      {/* Category quick filters */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Filter:</span>
          {['All', ...categories].map((cat) => (
            <button key={cat} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      <Card padding="none">
        <div className="table-header">
          <h2>UOM Registry</h2>
          <div className="search-bar"><Search size={14} /><input placeholder="Search units…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Unit Name</th><th>Code / Symbol</th><th>Category</th><th>Decimal Places</th><th>Conversion Factor</th><th>Base Unit</th><th></th></tr></thead>
            <tbody>
              {filtered.map((uom) => (
                <tr key={uom.id}>
                  <td><strong>{uom.name}</strong></td>
                  <td><span style={{ fontFamily: 'monospace', background: 'var(--bg-card-alt)', padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{uom.code}</span></td>
                  <td>{uom.category ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td>{uom.decimalPlaces ?? 2}</td>
                  <td>{uom.conversionFactor ?? 1}</td>
                  <td>{uom.isBase ? <span className="badge badge--green"><span className="badge__dot" />Base unit</span> : <span className="badge badge--gray"><span className="badge__dot" />Derived</span>}</td>
                  <td>
                    <button onClick={() => deleteUom(uom.id)} style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-card-alt)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--error)' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Scale size={28} /></div><b>No UOMs found</b><p>Create your first unit of measure — e.g. kg, MT, Bag.</p></div>}
        </div>
      </Card>

      {open && (
        <Modal title="Create Unit of Measure" description="Add a new dynamic UOM. Set the category and conversion factor to support unit-agnostic quantity tracking." wide onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.name || !form.code}>Create UOM</Button></>}
        >
          <div className="form-grid-2">
            <FormField label="Unit Name" required hint="e.g. Metric Ton, Kilogram, Bag">
              <Input placeholder="Kilogram" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Symbol / Code" required hint="Short code used in reports">
              <Input placeholder="kg" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>
            <FormField label="Category" hint="Group related UOMs — e.g. Mass, Volume, Count">
              <Input placeholder="Mass" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </FormField>
            <FormField label="Decimal Places">
              <Input type="number" min={0} max={6} value={form.decimalPlaces} onChange={(e) => setForm({ ...form, decimalPlaces: e.target.value })} />
            </FormField>
            <FormField label="Conversion Factor" hint="Relative to base unit in category">
              <Input type="number" step="0.001" value={form.conversionFactor} onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} />
            </FormField>
          </div>
          <Notice variant="info">The conversion factor is used to normalise quantities across different units within the same category for reporting.</Notice>
        </Modal>
      )}
    </PageContainer>
  );
}
