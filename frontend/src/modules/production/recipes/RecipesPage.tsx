import { useEffect, useState } from 'react';
import { Plus, FlaskConical, Search, Trash2, Info } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';

interface RecipeLine { productId: string; name: string; percentage: number; wastePct: number; }
interface Recipe {
  id: string; name: string; code: string; targetTonnage: number; isActive: boolean;
  fgProduct?: { name: string; sku: string } | null;
  ingredients: Array<{
    id: string;
    rawMaterial?: { name: string; sku: string } | null;
    percentage: number; quantityPerTon: number; wastePct: number;
  }>;
  totalWastePct?: number;
}
interface Product { id: string; name: string; sku: string; type: string; }

export function RecipesPage() {
  const [rows, setRows] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', fgProductId: '', targetTonnage: '1' });
  const [ingredients, setIngredients] = useState<RecipeLine[]>([
    { productId: '', name: '', percentage: 0, wastePct: 0 }
  ]);

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [r, p] = await Promise.all([api<{ data: Recipe[] }>('/recipes'), api<{ data: Product[] }>('/products')]);
      setRows(r.data); setProducts(p.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const totalPct = ingredients.reduce((s, i) => s + Number(i.percentage), 0);
  const rmProducts = products.filter((p) => p.type === 'RAW_MATERIAL');
  const fgProducts = products.filter((p) => p.type === 'FINISHED_GOOD');

  const addIngredient = () => setIngredients([...ingredients, { productId: '', name: '', percentage: 0, wastePct: 0 }]);
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, li) => li !== i));
  const updateIngredient = (i: number, field: keyof RecipeLine, value: string | number) =>
    setIngredients(ingredients.map((l, li) => li === i ? { ...l, [field]: value } : l));

  const submit = async () => {
    try {
      if (Math.abs(totalPct - 100) > 0.01) return setMessage('Ingredient percentages must sum to 100%.');
      await api('/recipes', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          targetTonnage: Number(form.targetTonnage),
          ingredients: ingredients.filter((i) => i.productId).map((i) => ({
            rawMaterialId: i.productId,
            percentage: Number(i.percentage),
            wastePct: Number(i.wastePct),
          })),
        }),
      });
      setOpen(false);
      setForm({ name: '', code: '', fgProductId: '', targetTonnage: '1' });
      setIngredients([{ productId: '', name: '', percentage: 0, wastePct: 0 }]);
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const pctColor = (pct: number) => {
    if (pct < 1) return 'var(--success)';
    if (pct < 3) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <PageContainer
      cap="PRODUCTION"
      title="Nutritionist Recipes"
      description="Define 1-ton base formulations. Ingredient percentages must total 100%. Production orders auto-scale quantities."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Recipe</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      <div className="two-col">
        {/* Recipe list */}
        <div className="card" style={{ padding: 0 }}>
          <div className="table-header">
            <h2>Recipe Library</h2>
            <div className="search-bar">
              <Search size={14} /><input placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ padding: 12, display: 'grid', gap: 8 }}>
            {rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())).map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 10, border: `1.5px solid ${selected?.id === recipe.id ? 'var(--brand-accent)' : 'var(--border-subtle)'}`, background: selected?.id === recipe.id ? 'rgba(168,213,72,0.06)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.12s' }}
              >
                <div style={{ width: 40, height: 40, background: 'var(--brand-glow)', borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <FlaskConical size={18} style={{ color: 'var(--brand-secondary)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{recipe.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {recipe.code} · {recipe.fgProduct?.name ?? 'No FG linked'} · {recipe.ingredients.length} ingredients
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <span className="badge badge--brand"><span className="badge__dot" />{recipe.targetTonnage}T base</span>
                    {recipe.isActive ? <span className="badge badge--green"><span className="badge__dot" />Active</span> : <span className="badge badge--gray"><span className="badge__dot" />Inactive</span>}
                  </div>
                </div>
              </button>
            ))}
            {rows.length === 0 && (
              <div className="empty-state"><div className="empty-state__icon"><FlaskConical size={28} /></div><b>No recipes yet</b><p>Create your first formulation recipe.</p></div>
            )}
          </div>
        </div>

        {/* Recipe detail */}
        <div className="card">
          {selected ? (
            <>
              <div className="card-header">
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.code} · Linked to: {selected.fgProduct?.name ?? 'No FG product'}</p>
                </div>
                <FlaskConical size={24} style={{ color: 'var(--brand-secondary)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[['Base Tonnage', `${selected.targetTonnage}T`], ['Ingredients', `${selected.ingredients.length}`], ['Avg Waste', `${(selected.ingredients.reduce((s, i) => s + i.wastePct, 0) / (selected.ingredients.length || 1)).toFixed(2)}%`]].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-card-alt)', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700, marginTop: 4 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {selected.ingredients.map((ing, i) => (
                  <div key={i} className="recipe-line">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ing.rawMaterial?.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ing.rawMaterial?.sku} · {ing.quantityPerTon?.toLocaleString() ?? '—'} kg/ton</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-primary)' }}>{Number(ing.percentage).toFixed(2)}%</div>
                      <div style={{ fontSize: 11, color: pctColor(Number(ing.wastePct)), fontWeight: 600 }}>Waste: {Number(ing.wastePct).toFixed(2)}%</div>
                    </div>
                    <div style={{ width: 80 }}>
                      <div className="waste-meter">
                        <div className="waste-meter__fill waste-meter__fill--ok" style={{ width: `${Math.min(Number(ing.percentage), 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon"><Info size={28} /></div>
              <b>Select a recipe</b>
              <p>Click any recipe in the list to see its full formulation details.</p>
            </div>
          )}
        </div>
      </div>

      {open && (
        <Modal title="New Production Recipe" description="Define a 1-ton base formulation. Ingredient percentages must total exactly 100%." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save Recipe</Button></>}
        >
          <div className="ui-form-grid">
            <FormField label="Recipe Name" required><Input placeholder="e.g. Broiler Starter Formula" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Recipe Code" required><Input placeholder="e.g. BSF-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></FormField>
            <FormField label="Linked FG Product"><Select value={form.fgProductId} onChange={(e) => setForm({ ...form, fgProductId: e.target.value })}><option value="">— Select FG product —</option>{fgProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</Select></FormField>
            <FormField label="Base Target Tonnage"><Input type="number" value={form.targetTonnage} onChange={(e) => setForm({ ...form, targetTonnage: e.target.value })} /></FormField>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Ingredients</strong>
                <span style={{ marginLeft: 10, fontSize: 13, color: Math.abs(totalPct - 100) < 0.01 ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                  Total: {totalPct.toFixed(2)}% {Math.abs(totalPct - 100) < 0.01 ? '✓' : '(must be 100%)'}
                </span>
              </div>
              <Button size="sm" variant="secondary" onClick={addIngredient}><Plus size={14} /> Add</Button>
            </div>
            {ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 36px', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                <FormField label={i === 0 ? 'Raw Material' : ''}>
                  <Select value={ing.productId} onChange={(e) => updateIngredient(i, 'productId', e.target.value)}>
                    <option value="">— Select RM —</option>
                    {rmProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </FormField>
                <FormField label={i === 0 ? '% Share' : ''}>
                  <Input type="number" placeholder="%" value={ing.percentage} onChange={(e) => updateIngredient(i, 'percentage', Number(e.target.value))} />
                </FormField>
                <FormField label={i === 0 ? 'Waste %' : ''}>
                  <Input type="number" placeholder="0.5" value={ing.wastePct} onChange={(e) => updateIngredient(i, 'wastePct', Number(e.target.value))} />
                </FormField>
                <button onClick={() => removeIngredient(i)} style={{ height: 40, border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-card-alt)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--error)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


