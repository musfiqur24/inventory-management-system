import { useEffect, useState } from 'react';
import { Plus, FlaskConical, Search, PackageCheck, AlertTriangle, Boxes } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';
import { statusBadge } from '../../../components/ui/Badge';

interface Category {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId?: string | null;
}

interface UOM {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  type: string;
  categoryId: string;
  category?: {
    name: string;
    code: string;
    parent?: {
      name: string;
      parent?: {
        name: string;
        parent?: {
          name: string;
        };
      };
    };
  } | null;
  baseUomId?: string;
  baseUom?: { code: string; name: string } | null;
  reorderLevel?: number | null;
  shelfLifeDays?: number | null;
  totalQty?: number;
  isBelowReorder?: boolean;
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | 'RAW_MATERIAL' | 'FINISHED_GOOD' | 'PACKAGING'>('ALL');
  const [message, setMessage] = useState('');

  // Cascading Category Picker States for Create Form (L1 -> L2 -> L3 -> L4)
  const [selectedL1, setSelectedL1] = useState('');
  const [selectedL2, setSelectedL2] = useState('');
  const [selectedL3, setSelectedL3] = useState('');
  const [selectedL4, setSelectedL4] = useState('');

  const [form, setForm] = useState({
    sku: '',
    name: '',
    type: 'FINISHED_GOOD',
    baseUomId: '',
    reorderLevel: '',
    shelfLifeDays: '',
  });

  const loadData = async () => {
    if (!selectedOrg()) return setMessage('Please select an organisation first.');
    try {
      const [prodRes, catRes, uomRes] = await Promise.all([
        api<{ data: Product[] }>('/products'),
        api<{ data: Category[] }>('/categories'),
        api<{ data: UOM[] }>('/uoms'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      setUoms(uomRes.data);
      setMessage('');
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered categories for cascading selection
  const l1List = categories.filter((c) => c.level === 1);
  const l2List = categories.filter((c) => c.level === 2 && (selectedL1 ? c.parentId === selectedL1 : true));
  const l3List = categories.filter((c) => c.level === 3 && (selectedL2 ? c.parentId === selectedL2 : true));
  const l4List = categories.filter((c) => c.level === 4 && (selectedL3 ? c.parentId === selectedL3 : true));

  const submit = async () => {
    try {
      if (!selectedL4) {
        throw new Error('Please select all 4 category stages (L1 → L2 → L3 → L4) for this product.');
      }
      if (!form.sku || !form.name || !form.baseUomId) {
        throw new Error('Please fill in required product fields: SKU, Name, and Base UOM.');
      }

      await api('/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: form.sku.toUpperCase().trim(),
          name: form.name.trim(),
          type: form.type,
          categoryId: selectedL4,
          baseUomId: form.baseUomId,
          reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : undefined,
          shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : undefined,
        }),
      });

      setOpen(false);
      setSelectedL1('');
      setSelectedL2('');
      setSelectedL3('');
      setSelectedL4('');
      setForm({ sku: '', name: '', type: 'FINISHED_GOOD', baseUomId: '', reorderLevel: '', shelfLifeDays: '' });
      void loadData();
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  // Helper to format category hierarchy path (L1 > L2 > L3 > L4)
  const formatHierarchyPath = (p: Product) => {
    if (!p.category) return '—';
    const c = p.category;
    const l4 = c.name;
    const l3 = c.parent?.name;
    const l2 = c.parent?.parent?.name;
    const l1 = c.parent?.parent?.parent?.name;

    const parts = [l1, l2, l3, l4].filter(Boolean);
    return parts.length > 0 ? parts.join(' › ') : c.name;
  };

  const filteredProducts = products.filter((p) => {
    const matchesTab = tab === 'ALL' || p.type === tab;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      formatHierarchyPath(p).toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalProducts = products.length;
  const rawCount = products.filter((p) => p.type === 'RAW_MATERIAL').length;
  const fgCount = products.filter((p) => p.type === 'FINISHED_GOOD').length;
  const lowStockCount = products.filter((p) => p.isBelowReorder).length;

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Products (L5 SKUs)"
      description="Manage master catalog of raw material ingredients and finished feed products. Every product is classified under the 4-stage category hierarchy."
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> Create Product SKU
        </Button>
      }
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      {/* Stats Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}>
            <FlaskConical size={20} />
          </div>
          <div>
            <div className="stat-card__val">{totalProducts}</div>
            <div className="stat-card__label">Total Registered SKUs</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(24, 100, 171, 0.1)', color: '#1864ab' }}>
            <Boxes size={20} />
          </div>
          <div>
            <div className="stat-card__val">{rawCount}</div>
            <div className="stat-card__label">Raw Ingredients</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(27, 143, 90, 0.1)', color: '#1b8f5a' }}>
            <PackageCheck size={20} />
          </div>
          <div>
            <div className="stat-card__val">{fgCount}</div>
            <div className="stat-card__label">Finished Feed SKUs</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="stat-card__val">{lowStockCount}</div>
            <div className="stat-card__label">Reorder Alerts</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div className="tabs">
            <button className={`tab ${tab === 'ALL' ? 'tab--active' : ''}`} onClick={() => setTab('ALL')}>
              All Products ({totalProducts})
            </button>
            <button className={`tab ${tab === 'RAW_MATERIAL' ? 'tab--active' : ''}`} onClick={() => setTab('RAW_MATERIAL')}>
              Raw Materials ({rawCount})
            </button>
            <button className={`tab ${tab === 'FINISHED_GOOD' ? 'tab--active' : ''}`} onClick={() => setTab('FINISHED_GOOD')}>
              Finished Feeds ({fgCount})
            </button>
          </div>

          <div style={{ position: 'relative', minWidth: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <Input
              placeholder="Search product name, SKU, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {/* Products Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Product Name</th>
                <th>Classification Hierarchy (L1 → L2 → L3 → L4)</th>
                <th>Type</th>
                <th>Base UOM</th>
                <th>Reorder Threshold</th>
                <th>Total Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No product SKUs found. Click <strong>Create Product SKU</strong> to add your first product.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code style={{ background: 'var(--bg-card-alt)', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                        {p.sku}
                      </code>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span className="badge badge--info" style={{ fontSize: 11 }}>
                        {formatHierarchyPath(p)}
                      </span>
                    </td>
                    <td>{statusBadge(p.type)}</td>
                    <td style={{ fontWeight: 600 }}>{p.baseUom?.code ?? 'kg'}</td>
                    <td>{p.reorderLevel !== null && p.reorderLevel !== undefined ? `${p.reorderLevel} ${p.baseUom?.code ?? 'kg'}` : '—'}</td>
                    <td style={{ fontWeight: 700, color: p.isBelowReorder ? 'var(--error)' : 'var(--text-primary)' }}>
                      {(p.totalQty ?? 0).toLocaleString()} {p.baseUom?.code ?? 'kg'}
                    </td>
                    <td>
                      {p.isBelowReorder ? (
                        <span className="badge badge--error">Low Stock Alert</span>
                      ) : (
                        <span className="badge badge--success">Normal</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Product Modal with 4-Stage Cascading Category Selection */}
      {open && (
        <Modal
          title="Create Product SKU (Level 5)"
          description="Select the 4 preceding category stages in sequence (L1 → L2 → L3 → L4), then enter the Level 5 Product SKU details."
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submit} disabled={!selectedL4 || !form.name || !form.sku || !form.baseUomId}>
                Save Product SKU
              </Button>
            </>
          }
        >
          <div className="form-section-title">Stage 1 to 4: Category Hierarchy Selection</div>
          <div className="form-grid-2">
            <FormField label="1. Level 1 — Material Type" required>
              <Select
                value={selectedL1}
                onChange={(e) => {
                  setSelectedL1(e.target.value);
                  setSelectedL2('');
                  setSelectedL3('');
                  setSelectedL4('');
                }}
              >
                <option value="">-- Choose Level 1 Type --</option>
                {l1List.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="2. Level 2 — Division / Class" required>
              <Select
                value={selectedL2}
                disabled={!selectedL1}
                onChange={(e) => {
                  setSelectedL2(e.target.value);
                  setSelectedL3('');
                  setSelectedL4('');
                }}
              >
                <option value="">-- Choose Level 2 Class --</option>
                {l2List.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="3. Level 3 — Feed Line / Sub-Class" required>
              <Select
                value={selectedL3}
                disabled={!selectedL2}
                onChange={(e) => {
                  setSelectedL3(e.target.value);
                  setSelectedL4('');
                }}
              >
                <option value="">-- Choose Level 3 Sub-Class --</option>
                {l3List.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="4. Level 4 — Stage / Family" required>
              <Select value={selectedL4} disabled={!selectedL3} onChange={(e) => setSelectedL4(e.target.value)}>
                <option value="">-- Choose Level 4 Family --</option>
                {l4List.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="form-section-title">Stage 5: Product SKU Specification</div>
          <div className="form-grid-2">
            <FormField label="Product Name" required hint="e.g. Broiler Starter Crumble 50kg">
              <Input placeholder="Broiler Starter Crumble" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>

            <FormField label="SKU Code" required hint="Unique stock keeping unit code">
              <Input placeholder="FG-BROIL-START-50KG" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} />
            </FormField>

            <FormField label="Material Type" required>
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

            <FormField label="Reorder Level Threshold" hint="Minimum inventory before reorder trigger">
              <Input type="number" placeholder="500" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            </FormField>

            <FormField label="Shelf Life (Days)" hint="Days before expiry warning">
              <Input type="number" placeholder="180" value={form.shelfLifeDays} onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })} />
            </FormField>
          </div>

          <Notice variant="info">
            Cascading selection logic: You must select Level 1 (Type) → Level 2 (Class) → Level 3 (Sub-Class) → Level 4 (Family) to register a new Level 5 Product SKU.
          </Notice>
        </Modal>
      )}
    </PageContainer>
  );
}
