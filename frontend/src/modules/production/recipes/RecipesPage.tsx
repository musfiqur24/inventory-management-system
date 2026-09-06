import type { CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';
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

  const wasteColorClasses = (pct: number) => {
    if (pct < 1) return 'text-[#1b8f5a]';
    if (pct < 3) return 'text-[#c87d12]';
    return 'text-[#c03030]';
  };

  return (
    <PageContainer
      cap="PRODUCTION"
      title="Nutritionist Recipes"
      description="Define 1-ton base formulations. Ingredient percentages must total 100%. Production orders auto-scale quantities."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Recipe</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
   >

      <div className="grid grid-cols-[1fr_1.2fr] gap-5 max-[900px]:grid-cols-[1fr]">
        {/* Recipe list */}
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
            <h2>Recipe Library</h2>
            <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]">
              <Search size={14} /><input placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="p-3 grid gap-2">
            {rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())).map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className={twMerge("flex items-start gap-3 p-3.5 rounded-[10px] cursor-pointer text-left w-full [transition:all_0.12s]", (selected?.id === recipe.id ? "bg-[rgba(168,213,72,0.06)] [border:1.5px_solid_#a8d548]" : "bg-[#ffffff] [border:1.5px_solid_#e0e5dd]"))}
             >
                <div className="w-10 h-10 bg-[rgba(168,213,72,0.18)] rounded-[10px] grid place-items-center shrink-0">
                  <FlaskConical size={18} className="text-[#1a5c45]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px]">{recipe.name}</div>
                  <div className="text-[11.5px] text-[#7a9185] mt-0.5">
                    {recipe.code} · {recipe.fgProduct?.name ?? 'No FG linked'} · {recipe.ingredients.length} ingredients
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[rgba(168,213,72,0.18)] text-[#1a5c45]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />{recipe.targetTonnage}T base</span>
                    {recipe.isActive ? <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#eaf8f0] text-[#1b8f5a]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Active</span> : <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#f0f2ee] text-[#7a9185]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Inactive</span>}
                  </div>
                </div>
              </button>
            ))}
            {rows.length === 0 && (
              <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><FlaskConical size={28} /></div><b>No recipes yet</b><p>Create your first formulation recipe.</p></div>
            )}
          </div>
        </Card>

        {/* Recipe detail */}
        <Card>
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-0">
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.code} · Linked to: {selected.fgProduct?.name ?? 'No FG product'}</p>
                </div>
                <FlaskConical size={24} className="text-[#1a5c45]" />
              </div>

              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2.5 mb-5">
                {[['Base Tonnage', `${selected.targetTonnage}T`], ['Ingredients', `${selected.ingredients.length}`], ['Avg Waste', `${(selected.ingredients.reduce((s, i) => s + i.wastePct, 0) / (selected.ingredients.length || 1)).toFixed(2)}%`]].map(([k, v]) => (
                  <div key={k} className="bg-[#f8faf7] rounded-[10px] p-3">
                    <div className="text-[10.5px] text-[#7a9185] font-bold tracking-[0.08em] uppercase">{k}</div>
                    <div className="[font-family:'Outfit',_sans-serif] text-[22px] font-bold mt-1">{v}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2">
                {selected.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-[8px] bg-[#f8faf7] [border:1px_solid_#e0e5dd] [transition:box-shadow_0.12s] [&:hover]:shadow-[0_1px_3px_rgba(0,0,0,0.07),_0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold">{ing.rawMaterial?.name ?? '—'}</div>
                      <div className="text-[11px] text-[#7a9185] mt-0.5">{ing.rawMaterial?.sku} · {ing.quantityPerTon?.toLocaleString() ?? '—'} kg/ton</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-bold text-[#0d3b2e]">{Number(ing.percentage).toFixed(2)}%</div>
                      <div className={twMerge("text-[11px] font-semibold", wasteColorClasses(Number(ing.wastePct)))}>Waste: {Number(ing.wastePct).toFixed(2)}%</div>
                    </div>
                    <div className="w-20">
                      <div className="relative h-2 bg-[#e0e5dd] rounded-[4px] overflow-hidden">
                        <div className="absolute left-0 top-0 h-full rounded-[4px] [transition:width_0.4s_ease] [background:linear-gradient(90deg,_#1b8f5a,_#a8e6c4)] w-[var(--meter-width)]" style={{ "--meter-width": `${Math.min(Number(ing.percentage), 100)}%` } as CSSProperties} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70">
              <div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Info size={28} /></div>
              <b>Select a recipe</b>
              <p>Click any recipe in the list to see its full formulation details.</p>
            </div>
          )}
        </Card>
      </div>

      {open && (
        <Modal title="New Production Recipe" description="Define a 1-ton base formulation. Ingredient percentages must total exactly 100%." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save Recipe</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
            <FormField label="Recipe Name" required><Input placeholder="e.g. Broiler Starter Formula" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Recipe Code" required><Input placeholder="e.g. BSF-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></FormField>
            <FormField label="Linked FG Product"><Select value={form.fgProductId} onChange={(e) => setForm({ ...form, fgProductId: e.target.value })}><option value="">— Select FG product —</option>{fgProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</Select></FormField>
            <FormField label="Base Target Tonnage"><Input type="number" value={form.targetTonnage} onChange={(e) => setForm({ ...form, targetTonnage: e.target.value })} /></FormField>
          </div>

          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="flex justify-between items-center mb-2.5">
              <div>
                <strong className="text-[14px]">Ingredients</strong>
                <span className={twMerge("ml-2.5 text-[13px] font-bold", (Math.abs(totalPct - 100) < 0.01 ? "text-[#1b8f5a]" : "text-[#c03030]"))}>
                  Total: {totalPct.toFixed(2)}% {Math.abs(totalPct - 100) < 0.01 ? '✓' : '(must be 100%)'}
                </span>
              </div>
              <Button size="sm" variant="secondary" onClick={addIngredient}><Plus size={14} /> Add</Button>
            </div>
            {ingredients.map((ing, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_36px] gap-2 mb-2 items-end">
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
                <button onClick={() => removeIngredient(i)} className="h-10 [border:1px_solid_#e0e5dd] rounded-[8px] bg-[#f8faf7] cursor-pointer grid place-items-center text-[#c03030]">
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


