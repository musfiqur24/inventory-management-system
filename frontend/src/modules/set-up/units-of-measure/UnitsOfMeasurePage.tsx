import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import { useEffect, useState } from 'react';
import { Plus, Pencil, Scale, Search, Trash2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Input } from '../../../components/ui/Input';

interface UOM { id: string; name: string; code: string; decimalPlaces?: number; isBase?: boolean; dimension: string; factorToBase: string | number; }

export function UnitsOfMeasurePage() {
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [rows, setRows] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UOM | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, setMessage] = useToastMessage();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', category: 'WEIGHT', decimalPlaces: '2', conversionFactor: '1' });

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try { const r = await api<{ data: UOM[] }>('/uoms'); setRows(r.data); setMessage(''); }
    catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); void api<{ data: { value: string; label: string }[] }>('/uoms/categories').then(result => setCategoryOptions(result.data)).catch(error => setMessage(error.message)); }, []);

  const submit = async () => {
    if (saving) return;
    const factorToBase = Number(form.conversionFactor);
    if (!form.name.trim() || !form.code.trim()) return setMessage('Enter a unit name and code.');
    if (!form.conversionFactor.trim() || !Number.isFinite(factorToBase) || factorToBase <= 0) {
      return setMessage('Enter a conversion factor greater than zero.');
    }
    setSaving(true);
    try {
      await api(editingId ? `/uoms/${editingId}` : '/uoms', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ name: form.name.trim(), code: form.code.trim(), dimension: form.category.trim() || 'WEIGHT', factorToBase }),
      });
      setOpen(false); setForm({ name: '', code: '', category: '', decimalPlaces: '2', conversionFactor: '1' }); void load();
    } catch (e: any) { setMessage(e.message); } finally { setSaving(false); }
  };

  const deleteUom = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api(`/uoms/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      void load();
    } catch (e: any) { setMessage(e.message); }
    finally { setDeleting(false); }
  };

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(rows.map((r) => r.dimension).filter(Boolean))];

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Units of Measure"
      description="Dynamic UOM management. Create mass, volume, or custom units for products, recipes, and transactions."
      actions={<Button variant="primary" onClick={() => { setEditingId(null); setForm({ name: '', code: '', category: '', decimalPlaces: '2', conversionFactor: '1' }); setOpen(true); }}><Plus size={16} /> New UOM</Button>}
   >

      {/* Category quick filters */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="text-[12px] text-[#7a9185] [align-self:center]">Filter:</span>
          {['All', ...categories].map((cat) => (
            <button key={cat} className="p-[4px_12px] rounded-[20px] [border:1px_solid_#e0e5dd] bg-[#ffffff] text-[12px] cursor-pointer text-[#445e50] font-semibold">
              {cat}
            </button>
          ))}
        </div>
      )}

      <Card padding="none">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>UOM Registry</h2>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search units…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <DataTable columns={["Unit Name","Code / Symbol","Category","Decimal Places","Conversion Factor","Base Unit","Action"]} empty={filtered.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Scale size={28} /></div><b>No UOMs found</b><p>Create your first unit of measure — e.g. kg, MT, Bag.</p></div>}>
              {filtered.map((uom) => (
                <tr key={uom.id}>
                  <td><strong>{uom.name}</strong></td>
                  <td><span className="font-mono bg-[#f8faf7] p-[2px_8px] rounded-[6px] text-[13px] font-bold">{uom.code}</span></td>
                  <td>{categoryOptions.find(category => category.value === uom.dimension)?.label ?? uom.dimension ?? <span className="text-[#7a9185]">—</span>}</td>
                  <td>{uom.decimalPlaces ?? 2}</td>
                  <td>{uom.factorToBase}</td>
                  <td>{uom.isBase ? <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#eaf8f0] text-[#1b8f5a]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Base unit</span> : <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#f0f2ee] text-[#7a9185]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Derived</span>}</td>
                  <td>
                    <div className="flex items-center gap-2">
                    <Button variant="secondary" className="size-11 shrink-0 p-0" aria-label={`Edit ${uom.name}`} onClick={() => { setEditingId(uom.id); setForm({ name: uom.name, code: uom.code, category: uom.dimension, decimalPlaces: String(uom.decimalPlaces ?? 2), conversionFactor: String(uom.factorToBase) }); setOpen(true); }}><Pencil size={16} /></Button>
                    <Button variant="secondary" className="size-11 shrink-0 p-0 text-[#c03030] hover:border-red-200 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${uom.name}`} onClick={() => setDeleteTarget(uom)}>
                      <Trash2 size={16} />
                    </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          
        </div>
      </Card>

      {deleteTarget && (
        <ConfirmationModal title="Delete unit of measure?" confirmLabel="Delete UOM" pendingLabel="Deleting..." pending={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={deleteUom}>
          <p>Are you sure you want to delete <strong>{deleteTarget.name} ({deleteTarget.code})</strong>? This action cannot be undone.</p>
        </ConfirmationModal>
      )}

      {open && (
        <Modal title={editingId ? "Edit Unit of Measure" : "Create Unit of Measure"} description="Set the unit name, code, category and conversion factor." wide onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving || !categoryOptions.length || !form.name.trim() || !form.code.trim()}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create UOM'}</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-x-4 gap-y-2 [&>div]:mb-0 max-[640px]:grid-cols-[1fr]">
            <FormField label="Unit Name" required hint="e.g. Metric Ton, Kilogram, Bag">
              <Input placeholder="Kilogram" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Symbol / Code" required hint="Short code used in reports">
              <Input placeholder="kg" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>
            <FormField label="Category" hint="Group related UOMs — e.g. Mass, Volume, Count">
              <Dropdown aria-label="Category" value={form.category} disabled={!categoryOptions.length} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {!categoryOptions.length && <option value="WEIGHT">Loading categories...</option>}
                {categoryOptions.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
              </Dropdown>
            </FormField>
            <FormField label="Decimal Places">
              <Input type="number" min={0} max={6} value={form.decimalPlaces} onChange={(e) => setForm({ ...form, decimalPlaces: e.target.value })} />
            </FormField>
            <FormField label="Conversion Factor" hint="Relative to base unit in category">
              <Input type="number" min="0" step="any" value={form.conversionFactor} onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} />
            </FormField>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
