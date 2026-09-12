import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { useToastMessage } from '../../../components/ui/Toast';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';

interface Category { id: string; name: string; code: string; level: number; parentId?: string | null; }
interface Product { id: string; sku: string; name: string; categoryId: string; baseUom?: { code: string } | null; }
interface UOM { id: string; code: string; name: string; }
const layerNames = ['Group Layer', 'Control Layer', 'Sub Layer', 'Sub- Sub Layer', 'Product'];
const emptyForm = { name: '', code: '', type: 'RAW_MATERIAL', baseUomId: '', reorderLevel: '' };

export function ProductHierarchyPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [activeLayer, setActiveLayer] = useState(5);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [, setMessage] = useToastMessage();
  const [targetLevel, setTargetLevel] = useState(5);
  const [parentL1, setParentL1] = useState('');
  const [parentL2, setParentL2] = useState('');
  const [parentL3, setParentL3] = useState('');
  const [parentL4, setParentL4] = useState('');
  const [form, setForm] = useState(emptyForm);
  const loadData = async () => {
    if (!selectedOrg()) return setMessage('Please select an organisation first.');
    setLoading(true);
    try {
      const [cats, prods, units] = await Promise.all([api<{data:Category[]}>('/categories'), api<{data:Product[]}>('/products'), api<{data:UOM[]}>('/uoms')]);
      setCategories(cats.data); setProducts(prods.data); setUoms(units.data);
    } catch (e: any) { setMessage(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadData(); }, []);
  const l1Categories = categories.filter(c => c.level === 1);
  const modalL2Options = categories.filter(c => c.level === 2 && c.parentId === parentL1);
  const modalL3Options = categories.filter(c => c.level === 3 && c.parentId === parentL2);
  const modalL4Options = categories.filter(c => c.level === 4 && c.parentId === parentL3);
  const submitNewLevel = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const parentId = [null, parentL1, parentL2, parentL3, parentL4][targetLevel - 1];
      if (targetLevel > 1 && !parentId) throw new Error('Please select the required parent layers.');
      if (targetLevel === 5 && !form.baseUomId) throw new Error('Please select a base UOM for this product.');
      await api(targetLevel === 5 ? '/products' : '/categories', { method: 'POST', body: JSON.stringify(targetLevel === 5
        ? { name: form.name.trim(), sku: form.code.trim(), type: form.type, categoryId: parentId, baseUomId: form.baseUomId, reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : undefined }
        : { name: form.name.trim(), code: form.code.trim(), level: targetLevel, parentId }) });
      setOpen(false); setActiveLayer(targetLevel); setSearch(''); setPage(1); void loadData();
    } catch (e: any) { setMessage(e.message); }
    finally { setSaving(false); }
  };
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const ancestorCodes = (id?: string | null) => {
    const codes: Record<number,string> = {};
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      visited.add(id);
      const category = categoryMap.get(id);
      if (!category) break;
      codes[category.level] = category.code;
      id = category.parentId;
    }
    return codes;
  };
  const rows = (activeLayer === 5
    ? products.map(product => ({ id: product.id, name: product.name, code: product.sku, parents: ancestorCodes(product.categoryId), uom: product.baseUom?.code ?? '-' }))
    : categories.filter(category => category.level === activeLayer).map(category => ({ id: category.id, name: category.name, code: category.code, parents: ancestorCodes(category.parentId), uom: '' })))
    .filter(row => [row.name, row.code, ...Object.values(row.parents)].some(value => value.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const layerName = layerNames[activeLayer - 1];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  const columns = [...layerNames.slice(0, activeLayer - 1).map(name => name + ' Code'), layerName + ' Code', layerName + ' Name', ...(activeLayer === 5 ? ['Base UOM'] : [])];
  return (
    <PageContainer cap="MASTER SETUP" title="Product Set Up" description="Manage your product layers and their parent relationships.">
      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-[#e0e5dd] p-6 sm:flex-row sm:items-center sm:gap-4">
          <label htmlFor="product-layer" className="shrink-0 text-sm font-semibold text-[#31483d]">Select Product Layer:</label>
          <Dropdown id="product-layer" className="sm:max-w-72" value={activeLayer} onChange={event => { setActiveLayer(Number(event.target.value)); setSearch(''); setPage(1); }}>
            {layerNames.map((name,index) => <option key={name} value={index + 1}>{name}</option>)}
          </Dropdown>
        </div>
        <div className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-[#0f1c16]">{layerName} List</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => { setTargetLevel(activeLayer); setForm(emptyForm); setParentL1(''); setParentL2(''); setParentL3(''); setParentL4(''); setOpen(true); }}><Plus size={16} /> New</Button>
              <Input aria-label="Search hierarchy" className="w-full sm:w-64" placeholder="Search code or name..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
              <Button className="size-11 p-0" aria-label="Refresh hierarchy" disabled={loading} onClick={() => void loadData()}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></Button>
            </div>
          </div>
          <DataTable columns={columns} total={rows.length} page={currentPage} pageSize={10} onPageChange={setPage}>
            {rows.slice((currentPage - 1) * 10, currentPage * 10).map(row => <tr key={row.id}>
              {layerNames.slice(0, activeLayer - 1).map((name,index) => <td key={name} className="font-mono text-xs">{row.parents[index + 1] ?? '-'}</td>)}
              <td className="font-mono text-xs">{row.code}</td><td className="font-medium">{row.name}</td>
              {activeLayer === 5 && <td>{row.uom}</td>}
            </tr>)}
            {!rows.length && <tr><td colSpan={columns.length} className="py-10 text-center text-[#73877c]">{loading ? 'Loading hierarchy...' : search ? 'No matching records.' : 'No records in this layer yet. Click New to add one.'}</td></tr>}
          </DataTable>
        </div>
      </Card>
      {open && (
        <Modal
          title={`New ${layerNames[targetLevel - 1]}`}
          description="Choose the parent layers and enter the code and name."
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submitNewLevel} disabled={saving || !form.name.trim() || !form.code.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          }
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-x-4 gap-y-2 [&>div]:mb-0 max-[640px]:grid-cols-[1fr]">
            <FormField label="Product Layer">
              <Input aria-label="Product Layer" value={layerNames[targetLevel - 1]} readOnly className="bg-[#f3f5f2] text-[#526b5e]" />
            </FormField>

            <FormField label="Name" required>
              <Input placeholder="Enter title..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>

            <FormField label="Code" required>
              <Input placeholder="e.g. POULTRY-01 or FG-BS-50KG" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>

            {targetLevel >= 2 && (
              <FormField label="Group Layer" required>
                <Dropdown value={parentL1} onChange={(e) => { setParentL1(e.target.value); setParentL2(''); setParentL3(''); setParentL4(''); }}>
                  <option value="">Choose Group Layer</option>
                  {l1Categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Dropdown>
              </FormField>
            )}

            {targetLevel >= 3 && (
              <FormField label="Control Layer" required>
                <Dropdown value={parentL2} disabled={!parentL1} onChange={(e) => { setParentL2(e.target.value); setParentL3(''); setParentL4(''); }}>
                  <option value="">Choose Control Layer</option>
                  {modalL2Options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Dropdown>
              </FormField>
            )}

            {targetLevel >= 4 && (
              <FormField label="Sub Layer" required>
                <Dropdown value={parentL3} disabled={!parentL2} onChange={(e) => { setParentL3(e.target.value); setParentL4(''); }}>
                  <option value="">Choose Sub Layer</option>
                  {modalL3Options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Dropdown>
              </FormField>
            )}

            {targetLevel === 5 && (
              <FormField label="Sub- Sub Layer" required>
                <Dropdown value={parentL4} disabled={!parentL3} onChange={(e) => setParentL4(e.target.value)}>
                  <option value="">Choose Sub- Sub Layer</option>
                  {modalL4Options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Dropdown>
              </FormField>
            )}

            {targetLevel === 5 && (
              <>
                <FormField label="Product Material Type" required>
                  <Dropdown value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="FINISHED_GOOD">Finished Good (Feed Product)</option>
                    <option value="RAW_MATERIAL">Raw Material (Ingredient)</option>
                    <option value="PACKAGING">Packaging Material</option>
                    <option value="BY_PRODUCT">By-Product</option>
                  </Dropdown>
                </FormField>

                <FormField label="Base Unit of Measure (UOM)" required>
                  <Dropdown value={form.baseUomId} onChange={(e) => setForm({ ...form, baseUomId: e.target.value })}>
                    <option value="">-- Select Base UOM --</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </Dropdown>
                </FormField>

                <FormField label="Reorder Level Threshold">
                  <Input type="number" placeholder="e.g. 500" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
                </FormField>
              </>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
