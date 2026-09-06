import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { Plus, ChevronRight, FolderTree } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';

interface Category {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId?: string | null;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  type: string;
  categoryId: string;
  baseUom?: { code: string } | null;
  reorderLevel?: number | null;
}

interface UOM {
  id: string;
  code: string;
  name: string;
}


export function ProductHierarchyPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  // Active navigation selection state across 5 levels
  const [selectedL1, setSelectedL1] = useState<string | null>(null);
  const [selectedL2, setSelectedL2] = useState<string | null>(null);
  const [selectedL3, setSelectedL3] = useState<string | null>(null);
  const [selectedL4, setSelectedL4] = useState<string | null>(null);

  // Form state for creating dynamic hierarchy level
  const [targetLevel, setTargetLevel] = useState<number>(1);
  const [parentL1, setParentL1] = useState<string>('');
  const [parentL2, setParentL2] = useState<string>('');
  const [parentL3, setParentL3] = useState<string>('');
  const [parentL4, setParentL4] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'RAW_MATERIAL',
    baseUomId: '',
    reorderLevel: '',
  });

  const loadData = async () => {
    if (!selectedOrg()) return setMessage('Please select an organisation first.');
    try {
      const [catRes, prodRes, uomRes] = await Promise.all([
        api<{ data: Category[] }>('/categories'),
        api<{ data: Product[] }>('/products'),
        api<{ data: UOM[] }>('/uoms'),
      ]);
      setCategories(catRes.data);
      setProducts(prodRes.data);
      setUoms(uomRes.data);
      setMessage('');

      // Auto select first L1 if available
      const l1List = catRes.data.filter((c) => c.level === 1);
      if (l1List.length > 0 && !selectedL1) {
        setSelectedL1(l1List[0].id);
      }
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered categories per level based on parent selections
  const l1Categories = categories.filter((c) => c.level === 1);
  const l2Categories = categories.filter((c) => c.level === 2 && (selectedL1 ? c.parentId === selectedL1 : true));
  const l3Categories = categories.filter((c) => c.level === 3 && (selectedL2 ? c.parentId === selectedL2 : true));
  const l4Categories = categories.filter((c) => c.level === 4 && (selectedL3 ? c.parentId === selectedL3 : true));
  const l5Products = products.filter((p) => (selectedL4 ? p.categoryId === selectedL4 : true));

  // Cascading lists for the modal
  const modalL2Options = categories.filter((c) => c.level === 2 && (parentL1 ? c.parentId === parentL1 : true));
  const modalL3Options = categories.filter((c) => c.level === 3 && (parentL2 ? c.parentId === parentL2 : true));
  const modalL4Options = categories.filter((c) => c.level === 4 && (parentL3 ? c.parentId === parentL3 : true));

  const handleSelectL1 = (id: string) => {
    setSelectedL1(id);
    setSelectedL2(null);
    setSelectedL3(null);
    setSelectedL4(null);
  };

  const handleSelectL2 = (id: string) => {
    setSelectedL2(id);
    setSelectedL3(null);
    setSelectedL4(null);
  };

  const handleSelectL3 = (id: string) => {
    setSelectedL3(id);
    setSelectedL4(null);
  };

  const handleSelectL4 = (id: string) => {
    setSelectedL4(id);
  };

  const submitNewLevel = async () => {
    try {
      if (targetLevel === 5) {
        if (!parentL4) throw new Error('Please select Level 1, 2, 3, and 4 parents for this Product SKU.');
        if (!form.baseUomId) throw new Error('Base UOM is required for Product SKU.');

        await api('/products', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            sku: form.code,
            type: form.type,
            categoryId: parentL4,
            baseUomId: form.baseUomId,
            reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : undefined,
          }),
        });
      } else {
        let resolvedParentId: string | null = null;
        if (targetLevel === 2) resolvedParentId = parentL1 || null;
        if (targetLevel === 3) resolvedParentId = parentL2 || null;
        if (targetLevel === 4) resolvedParentId = parentL3 || null;

        if (targetLevel > 1 && !resolvedParentId) {
          throw new Error(`Please select all required parent categories for Level ${targetLevel}.`);
        }

        await api('/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            code: form.code,
            level: targetLevel,
            parentId: resolvedParentId,
          }),
        });
      }

      setOpen(false);
      setForm({ name: '', code: '', type: 'RAW_MATERIAL', baseUomId: '', reorderLevel: '' });
      setParentL1('');
      setParentL2('');
      setParentL3('');
      setParentL4('');
      void loadData();
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  const activeL1Obj = categories.find((c) => c.id === selectedL1);
  const activeL2Obj = categories.find((c) => c.id === selectedL2);
  const activeL3Obj = categories.find((c) => c.id === selectedL3);
  const activeL4Obj = categories.find((c) => c.id === selectedL4);

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Product Hierarchy"
      description="5-level product taxonomy: Type → Class → Sub-Class → Family → Product SKU. Select parents in cascading sequence to drill down or create new nodes."
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add Hierarchy Node
        </Button>
      }
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
   >

      {/* Combined Hierarchy Explorer Container */}
      <Card padding="none">
        {/* Active Navigation Breadcrumb */}
        <div
           className="p-[14px_20px] [border-bottom:1px_solid_#e0e5dd] bg-[#ffffff] flex items-center gap-2 text-[13px] flex-wrap"
       >
          <FolderTree size={16} className="text-[#0d3b2e]" />
          <span className="font-bold text-[#7a9185]">Hierarchy Path:</span>

          <span className={twMerge(`inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap ${(activeL1Obj ? "bg-[#e8f2ff] text-[#1864ab]" : "")}`)}>
            {activeL1Obj ? activeL1Obj.name : 'All L1 Types'}
          </span>
          <ChevronRight size={14} className="text-[#7a9185]" />

          <span className={twMerge(`inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap ${(activeL2Obj ? "bg-[#e8f2ff] text-[#1864ab]" : "")}`)}>
            {activeL2Obj ? activeL2Obj.name : 'Select L2 Class'}
          </span>
          <ChevronRight size={14} className="text-[#7a9185]" />

          <span className={twMerge(`inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap ${(activeL3Obj ? "bg-[#e8f2ff] text-[#1864ab]" : "")}`)}>
            {activeL3Obj ? activeL3Obj.name : 'Select L3 Sub-Class'}
          </span>
          <ChevronRight size={14} className="text-[#7a9185]" />

          <span className={twMerge(`inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap ${(activeL4Obj ? "bg-[#e8f2ff] text-[#1864ab]" : "")}`)}>
            {activeL4Obj ? activeL4Obj.name : 'Select L4 Family'}
          </span>
        </div>

        {/* 5-Column Drill-Down Explorer */}
        <div className="p-4 overflow-x-auto">
          <div className="grid grid-cols-[repeat(5,_minmax(200px,_1fr))] gap-3.5 min-w-262.5">
            {/* Level 1 Column */}
            <div className="[border:1px_solid_#e0e5dd] rounded-[8px] overflow-hidden bg-[#ffffff]">
            <div className="bg-[#a8d548] text-[#0d3b2e] p-[10px_14px] text-[12px] font-extrabold">
              Level 1 — Type
            </div>
            <div className="p-2 min-h-70 max-h-112.5 overflow-y-auto">
              {l1Categories.length === 0 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">No L1 items</div>
              ) : (
                l1Categories.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectL1(item.id)}
                     className={twMerge("p-[10px_12px] rounded-[8px] mb-1.5 cursor-pointer text-[13px] flex items-center justify-between", (selectedL1 === item.id ? "font-bold" : "font-medium"), (selectedL1 === item.id ? "bg-[rgba(168,213,72,0.18)]" : "bg-[transparent]"), (selectedL1 === item.id ? "[border:1px_solid_rgba(168,213,72,0.4)]" : "[border:1px_solid_transparent]"), (selectedL1 === item.id ? "text-[#0d3b2e]" : "text-[#0f1c16]"))}
                 >
                    <div>
                      <div>{item.name}</div>
                      <div className="text-[10px] text-[#7a9185]">Code: {item.code}</div>
                    </div>
                    <ChevronRight size={14} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Level 2 Column */}
          <div className="[border:1px_solid_#e0e5dd] rounded-[8px] overflow-hidden bg-[#ffffff]">
            <div className="bg-[#1b8f5a] text-[#ffffff] p-[10px_14px] text-[12px] font-extrabold">
              Level 2 — Class
            </div>
            <div className="p-2 min-h-70 max-h-112.5 overflow-y-auto">
              {!selectedL1 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">Select L1 parent</div>
              ) : l2Categories.length === 0 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">No L2 under active L1</div>
              ) : (
                l2Categories.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectL2(item.id)}
                     className={twMerge("p-[10px_12px] rounded-[8px] mb-1.5 cursor-pointer text-[13px] flex items-center justify-between", (selectedL2 === item.id ? "font-bold" : "font-medium"), (selectedL2 === item.id ? "bg-[rgba(168,213,72,0.18)]" : "bg-[transparent]"), (selectedL2 === item.id ? "[border:1px_solid_rgba(168,213,72,0.4)]" : "[border:1px_solid_transparent]"), (selectedL2 === item.id ? "text-[#0d3b2e]" : "text-[#0f1c16]"))}
                 >
                    <div>
                      <div>{item.name}</div>
                      <div className="text-[10px] text-[#7a9185]">Code: {item.code}</div>
                    </div>
                    <ChevronRight size={14} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Level 3 Column */}
          <div className="[border:1px_solid_#e0e5dd] rounded-[8px] overflow-hidden bg-[#ffffff]">
            <div className="bg-[#1864ab] text-[#ffffff] p-[10px_14px] text-[12px] font-extrabold">
              Level 3 — Sub-Class
            </div>
            <div className="p-2 min-h-70 max-h-112.5 overflow-y-auto">
              {!selectedL2 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">Select L2 parent</div>
              ) : l3Categories.length === 0 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">No L3 under active L2</div>
              ) : (
                l3Categories.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectL3(item.id)}
                     className={twMerge("p-[10px_12px] rounded-[8px] mb-1.5 cursor-pointer text-[13px] flex items-center justify-between", (selectedL3 === item.id ? "font-bold" : "font-medium"), (selectedL3 === item.id ? "bg-[rgba(168,213,72,0.18)]" : "bg-[transparent]"), (selectedL3 === item.id ? "[border:1px_solid_rgba(168,213,72,0.4)]" : "[border:1px_solid_transparent]"), (selectedL3 === item.id ? "text-[#0d3b2e]" : "text-[#0f1c16]"))}
                 >
                    <div>
                      <div>{item.name}</div>
                      <div className="text-[10px] text-[#7a9185]">Code: {item.code}</div>
                    </div>
                    <ChevronRight size={14} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Level 4 Column */}
          <div className="[border:1px_solid_#e0e5dd] rounded-[8px] overflow-hidden bg-[#ffffff]">
            <div className="bg-[#7c3aed] text-[#ffffff] p-[10px_14px] text-[12px] font-extrabold">
              Level 4 — Family
            </div>
            <div className="p-2 min-h-70 max-h-112.5 overflow-y-auto">
              {!selectedL3 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">Select L3 parent</div>
              ) : l4Categories.length === 0 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">No L4 under active L3</div>
              ) : (
                l4Categories.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectL4(item.id)}
                     className={twMerge("p-[10px_12px] rounded-[8px] mb-1.5 cursor-pointer text-[13px] flex items-center justify-between", (selectedL4 === item.id ? "font-bold" : "font-medium"), (selectedL4 === item.id ? "bg-[rgba(168,213,72,0.18)]" : "bg-[transparent]"), (selectedL4 === item.id ? "[border:1px_solid_rgba(168,213,72,0.4)]" : "[border:1px_solid_transparent]"), (selectedL4 === item.id ? "text-[#0d3b2e]" : "text-[#0f1c16]"))}
                 >
                    <div>
                      <div>{item.name}</div>
                      <div className="text-[10px] text-[#7a9185]">Code: {item.code}</div>
                    </div>
                    <ChevronRight size={14} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Level 5 Product SKU Column */}
          <div className="[border:1px_solid_#e0e5dd] rounded-[8px] overflow-hidden bg-[#ffffff]">
            <div className="bg-[#c87d12] text-[#ffffff] p-[10px_14px] text-[12px] font-extrabold">
              Level 5 — Product SKUs
            </div>
            <div className="p-2 min-h-70 max-h-112.5 overflow-y-auto">
              {!selectedL4 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">Select L4 parent</div>
              ) : l5Products.length === 0 ? (
                <div className="p-4 text-center text-[#7a9185] text-[12px]">No Product SKUs under active L4</div>
              ) : (
                l5Products.map((prod) => (
                  <div
                    key={prod.id}
                     className="p-[10px_12px] rounded-[8px] mb-1.5 bg-[#f8faf7] [border:1px_solid_#e0e5dd] text-[13px]"
                 >
                    <div className="font-bold text-[#0f1c16]">{prod.name}</div>
                    <div className="flex gap-1.5 text-[11px] text-[#7a9185] mt-1">
                      <span>SKU: {prod.sku}</span>
                      <span>·</span>
                      <span>UOM: {prod.baseUom?.code ?? 'kg'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      </Card>

      {/* Dynamic Hierarchy Level Creation Modal */}
      {open && (
        <Modal
          title="Add Product Hierarchy Node"
          description="Select target level and fill in the cascading parent sequence (L1 → L2 → L3 → L4 → L5)."
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submitNewLevel} disabled={!form.name || !form.code}>
                Save Node
              </Button>
            </>
          }
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 max-[640px]:grid-cols-[1fr]">
            <FormField label="Target Hierarchy Level" required>
              <Select value={targetLevel} onChange={(e) => setTargetLevel(Number(e.target.value))}>
                <option value={1}>Level 1 — Material Type (Classification)</option>
                <option value={2}>Level 2 — Division / Class (Select L1)</option>
                <option value={3}>Level 3 — Sub-Class / Feed Line (Select L1 → L2)</option>
                <option value={4}>Level 4 — Family / Stage (Select L1 → L2 → L3)</option>
                <option value={5}>Level 5 — Product SKU (Select L1 → L2 → L3 → L4)</option>
              </Select>
            </FormField>

            <FormField label="Name / Title" required hint="e.g. Poultry Feed, Broiler Starter Crumble">
              <Input placeholder="Enter title..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>

            <FormField label="Code / SKU Identifier" required hint="Unique code for system identification">
              <Input placeholder="e.g. POULTRY-01 or FG-BS-50KG" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>

            {targetLevel >= 2 && (
              <FormField label="1. Select Level 1 Parent (Type)" required>
                <Select value={parentL1} onChange={(e) => { setParentL1(e.target.value); setParentL2(''); setParentL3(''); setParentL4(''); }}>
                  <option value="">-- Choose L1 Parent --</option>
                  {l1Categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            {targetLevel >= 3 && (
              <FormField label="2. Select Level 2 Parent (Class)" required>
                <Select value={parentL2} disabled={!parentL1} onChange={(e) => { setParentL2(e.target.value); setParentL3(''); setParentL4(''); }}>
                  <option value="">-- Choose L2 Parent --</option>
                  {modalL2Options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            {targetLevel >= 4 && (
              <FormField label="3. Select Level 3 Parent (Sub-Class)" required>
                <Select value={parentL3} disabled={!parentL2} onChange={(e) => { setParentL3(e.target.value); setParentL4(''); }}>
                  <option value="">-- Choose L3 Parent --</option>
                  {modalL3Options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            {targetLevel === 5 && (
              <FormField label="4. Select Level 4 Parent (Family / Stage)" required>
                <Select value={parentL4} disabled={!parentL3} onChange={(e) => setParentL4(e.target.value)}>
                  <option value="">-- Choose L4 Parent --</option>
                  {modalL4Options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            {targetLevel === 5 && (
              <>
                <FormField label="Product Material Type" required>
                  <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="FINISHED_GOOD">Finished Good (Feed Product)</option>
                    <option value="RAW_MATERIAL">Raw Material (Ingredient)</option>
                    <option value="PACKAGING">Packaging Material</option>
                    <option value="BY_PRODUCT">By-Product</option>
                  </Select>
                </FormField>

                <FormField label="Base Unit of Measure (UOM)" required>
                  <Select value={form.baseUomId} onChange={(e) => setForm({ ...form, baseUomId: e.target.value })}>
                    <option value="">-- Select Base UOM --</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Reorder Level Threshold">
                  <Input type="number" placeholder="e.g. 500" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
                </FormField>
              </>
            )}
          </div>

          <Notice variant="info">
            Hierarchy logic: Level 1 (Material Type) → Level 2 (Class) → Level 3 (Sub-Class) → Level 4 (Family) → Level 5 (Product SKU). Selecting parents in order ensures exact classification.
          </Notice>
        </Modal>
      )}
    </PageContainer>
  );
}


