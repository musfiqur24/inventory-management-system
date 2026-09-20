import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import type { CSSProperties } from 'react';
import { useToastMessage } from "../../../components/ui/Toast";
import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { Plus, FlaskConical, Search, Trash2, Info, Pencil, Printer } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { printReport } from '../../../shared/printReport';
import { useAuth } from '../../auth/AuthContext';

interface RecipeLine { productId: string; name: string; percentage: number; }
interface Recipe {
  id: string; name: string; code: string; targetTonnage: number; isActive: boolean;
  finishedProductId: string; outputQty: number; outputUomId: string;
  fgProduct?: { name: string; sku: string } | null;
  ingredients: Array<{
    id: string; rawProductId: string; uomId: string;
    rawMaterial?: { name: string; sku: string } | null;
    percentage: number; quantityPerTon: number;
  }>;
  totalWastePct?: number;
}
interface Product { id: string; name: string; sku: string; type: string; baseUomId: string; }

export function RecipesPage() {
  const { user } = useAuth();
  const isRecipeManager = Boolean(user?.isSuperAdmin || user?.organizations.find((organization) => organization.id === selectedOrg())?.role.code === 'MANAGER');
  const [pageLoading, runPageLoad] = usePageLoading();
  const [rows, setRows] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [, setMessage] = useToastMessage();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', fgProductId: '', targetTonnage: '1' });
  const [ingredients, setIngredients] = useState<RecipeLine[]>([
    { productId: '', name: '', percentage: 0 }
  ]);

  const load = async () => { return runPageLoad(async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [r, p] = await Promise.all([api<{ data: Recipe[] }>('/recipes'), api<{ data: Product[] }>('/products')]);
      setRows(r.data); setProducts(p.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  });};

  useEffect(() => { void load(); }, []);

  const totalPct = ingredients.reduce((s, i) => s + Number(i.percentage), 0);
  const rmProducts = products.filter((p) => p.type === 'RAW_MATERIAL');
  const fgProducts = products.filter((p) => p.type === 'FINISHED_GOOD');

  const addIngredient = () => setIngredients([...ingredients, { productId: '', name: '', percentage: 0 }]);
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, li) => li !== i));
  const updateIngredient = (i: number, field: keyof RecipeLine, value: string | number) =>
    setIngredients(ingredients.map((l, li) => li === i ? { ...l, [field]: value } : l));

  const submit = async () => {
    try {
      if (ingredients.some((ingredient) => Number(ingredient.percentage) < 0)) {
        return setMessage('Ingredient percentages cannot be negative.');
      }
      const selectedProductIds = ingredients.map((ingredient) => ingredient.productId).filter(Boolean);
      if (new Set(selectedProductIds).size !== selectedProductIds.length) {
        return setMessage('The same raw material cannot be selected more than once.');
      }
      if (Math.abs(totalPct - 100) > 0.01) return setMessage('Ingredient percentages must sum to 100%.');
      const finishedProduct = fgProducts.find((product) => product.id === form.fgProductId);
      if (!finishedProduct) return setMessage('Select a finished-good product.');
      if (!finishedProduct.baseUomId) return setMessage('The selected finished-good product has no base UOM.');

      const selectedIngredients = ingredients.filter(
        (ingredient) => ingredient.productId && Number(ingredient.percentage) > 0,
      );
      if (selectedIngredients.length === 0) return setMessage('Add at least one raw material.');

      const outputQty = Number(form.targetTonnage) * 1000;
      if (!Number.isFinite(outputQty) || outputQty <= 0) return setMessage('Base target tonnage must be greater than zero.');

      const lines = selectedIngredients.map((ingredient) => {
        const product = rmProducts.find((item) => item.id === ingredient.productId);
        if (!product?.baseUomId) throw new Error('The selected raw material has no base UOM.');
        return {
          rawProductId: ingredient.productId,
          uomId: product.baseUomId,
          quantityPerOutput: outputQty * (Number(ingredient.percentage) / 100),
        };
      });

      await api(editing ? `/recipes/${editing.id}` : '/recipes', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          finishedProductId: finishedProduct.id,
          outputQty,
          outputUomId: finishedProduct.baseUomId,
          wastePercent: 0,
          lines,
        }),
      });
      setOpen(false);
      setEditing(null);
      setSelected(null);
      setForm({ name: '', code: '', fgProductId: '', targetTonnage: '1' });
      setIngredients([{ productId: '', name: '', percentage: 0 }]);
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', fgProductId: '', targetTonnage: '1' });
    setIngredients([{ productId: '', name: '', percentage: 0 }]);
    setOpen(true);
  };

  const openEdit = (recipe: Recipe) => {
    setEditing(recipe);
    setForm({
      name: recipe.name,
      code: recipe.code,
      fgProductId: recipe.finishedProductId,
      targetTonnage: String(recipe.targetTonnage),
    });
    setIngredients(recipe.ingredients.map((ingredient) => ({
      productId: ingredient.rawProductId,
      name: ingredient.rawMaterial?.name ?? '',
      percentage: Number(ingredient.percentage),
    })));
    setOpen(true);
  };

  const removeRecipe = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/recipes/${deleteTarget.id}`, { method: 'DELETE' });
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const printRecipe = (recipe: Recipe) => {
    const ingredientRows = recipe.ingredients.map((ingredient) => `
      <tr>
        <td class="border border-slate-300 px-3 py-2">${ingredient.rawMaterial?.name ?? '-'}</td>
        <td class="border border-slate-300 px-3 py-2">${ingredient.rawMaterial?.sku ?? '-'}</td>
        <td class="border border-slate-300 px-3 py-2 text-right">${Number(ingredient.percentage).toFixed(2)}%</td>
        <td class="border border-slate-300 px-3 py-2 text-right">${Number(ingredient.quantityPerTon).toLocaleString()} kg</td>
      </tr>`).join('');
    printReport(`Recipe ${recipe.name}`, `
      <div class="mx-auto max-w-4xl">
        <h1 class="text-2xl font-bold">${recipe.name}</h1>
        <p class="mt-1 text-slate-600">${recipe.code} � Base formulation: ${recipe.targetTonnage} ton</p>
        <table class="mt-6 w-full border-collapse">
          <thead><tr class="bg-slate-100"><th class="border border-slate-300 px-3 py-2 text-left">Raw Material</th><th class="border border-slate-300 px-3 py-2 text-left">SKU</th><th class="border border-slate-300 px-3 py-2 text-right">Share</th><th class="border border-slate-300 px-3 py-2 text-right">Per Ton</th></tr></thead>
          <tbody>${ingredientRows}</tbody>
        </table>
      </div>`);
  };

  return (
    <PageContainer loading={pageLoading}
      cap="PRODUCTION"
      title="Nutritionist Recipes"
      description="Define 1-ton base formulations. Ingredient percentages must total 100%. Production orders auto-scale quantities."
      actions={isRecipeManager ? <Button variant="primary" onClick={openCreate}><Plus size={16} /> New Recipe</Button> : undefined}
   >

      <div className="grid grid-cols-[1fr_1.2fr] items-stretch gap-5 max-[900px]:grid-cols-[1fr]">
        {/* Recipe list */}
        <Card className="flex h-[520px] flex-col overflow-hidden p-0 max-[900px]:h-auto max-[900px]:max-h-[520px]">
          <div className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
            <h2>Recipe Library</h2>
            <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] w-full sm:max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]">
              <Search size={14} /><input placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="grid flex-1 content-start gap-2 overflow-y-auto p-3">
            {rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())).map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className={twMerge("flex items-start gap-3 p-3.5 rounded-[10px] cursor-pointer text-left w-full [transition:all_0.12s]", (selected?.id === recipe.id ? "bg-[rgba(168,213,72,0.06)] [border:1.5px_solid_#a8d548]" : "bg-[#fffdf8] [border:1.5px_solid_#e5ded0] hover:bg-[#f8f3e9]"))}
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
              <div className="flex flex-1 flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><FlaskConical size={28} /></div><b>No recipes yet</b></div>
            )}
          </div>
        </Card>

        {/* Recipe detail */}
        <Card className="flex h-[520px] flex-col overflow-hidden max-[900px]:h-auto max-[900px]:min-h-[360px]">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-0">
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.code} · Linked to: {selected.fgProduct?.name ?? 'No FG product'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" title="Print recipe" aria-label="Print recipe" onClick={() => printRecipe(selected)}><Printer size={15} /></Button>
                  {isRecipeManager && <Button size="sm" variant="secondary" title="Edit recipe" aria-label="Edit recipe" onClick={() => openEdit(selected)}><Pencil size={15} /></Button>}
                  {isRecipeManager && <Button size="sm" variant="danger" title="Delete recipe" aria-label="Delete recipe" onClick={() => setDeleteTarget(selected)}><Trash2 size={15} /></Button>}
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {[['Base Tonnage', `${selected.targetTonnage}T`], ['Ingredients', `${selected.ingredients.length}`]].map(([k, v]) => (
                  <div key={k} className="bg-[#f8faf7] rounded-[10px] p-3">
                    <div className="text-[10.5px] text-[#7a9185] font-bold tracking-[0.08em] uppercase">{k}</div>
                    <div className="[font-family:'Outfit',_sans-serif] text-[22px] font-bold mt-1">{v}</div>
                  </div>
                ))}
              </div>

              <div className="grid flex-1 content-start gap-2 overflow-y-auto pr-1">
                {selected.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-[8px] bg-[#f8faf7] [border:1px_solid_#e0e5dd] [transition:box-shadow_0.12s] [&:hover]:shadow-[0_1px_3px_rgba(0,0,0,0.07),_0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold">{ing.rawMaterial?.name ?? '—'}</div>
                      <div className="text-[11px] text-[#7a9185] mt-0.5">{ing.rawMaterial?.sku} · {ing.quantityPerTon?.toLocaleString() ?? '—'} kg/ton</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-bold text-[#0d3b2e]">{Number(ing.percentage).toFixed(2)}%</div>
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
        <Modal title={editing ? 'Edit Feed Recipe' : 'New Feed Recipe'} description="Define a 1-ton feed formulation. Ingredient percentages must total exactly 100%." onClose={() => setOpen(false)} wide fixedHeight
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>{editing ? 'Update Recipe' : 'Save Recipe'}</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
            <FormField label="Recipe Name" required><Input placeholder="e.g. Broiler Starter Formula" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Recipe Code" required><Input placeholder="e.g. BSF-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></FormField>
            <FormField label="Linked FG Product" required><Dropdown value={form.fgProductId} onChange={(e) => setForm({ ...form, fgProductId: e.target.value })}><option value="">— Select FG product —</option>{fgProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</Dropdown></FormField>
            <FormField label="Base Target Tonnage"><Input type="number" value={form.targetTonnage} onChange={(e) => setForm({ ...form, targetTonnage: e.target.value })} /></FormField>
          </div>

          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="mb-2.5">
              <div>
                <strong className="text-[14px]">Ingredients</strong>
                <span className={twMerge("ml-2.5 text-[13px] font-bold", (Math.abs(totalPct - 100) < 0.01 ? "text-[#1b8f5a]" : "text-[#c03030]"))}>
                  Total: {totalPct.toFixed(2)}% {Math.abs(totalPct - 100) < 0.01 ? '✓' : '(must be 100%)'}
                </span>
              </div>
            </div>
            <div className="mb-1.5 grid grid-cols-[minmax(0,_1fr)_90px_44px] gap-2 sm:grid-cols-[minmax(0,_1fr)_120px_44px] px-0.5 text-[12px] font-semibold text-[#31483d]">
              <span>Raw Material</span><span>% Share</span><span className="sr-only">Action</span>
            </div>
            <div className="h-[216px] overflow-y-auto overscroll-contain pr-1 [scrollbar-color:#9bad9f_transparent] [scrollbar-width:thin]">
              {ingredients.map((ing, i) => (
                <div key={i} className="mb-2 grid grid-cols-[minmax(0,_1fr)_90px_44px] items-center gap-2 sm:grid-cols-[minmax(0,_1fr)_120px_44px] last:mb-0">
                  <Dropdown aria-label={`Raw material ${i + 1}`} value={ing.productId} onChange={(e) => updateIngredient(i, 'productId', e.target.value)}>
                    <option value="">— Select RM —</option>
                    {rmProducts.map((p) => (
                      <option key={p.id} value={p.id} disabled={ingredients.some((line, lineIndex) => lineIndex !== i && line.productId === p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </Dropdown>
                  <Input aria-label={`Percentage share ${i + 1}`} type="number" min="0" max="100" step="0.01" placeholder="%" value={ing.percentage} onChange={(e) => updateIngredient(i, 'percentage', Math.max(0, Number(e.target.value)))} />
                  <button type="button" aria-label={`Remove ingredient ${i + 1}`} onClick={() => removeIngredient(i)} className="grid size-11 place-items-center rounded-lg border border-[#e4d8d3] bg-[#fff9f7] text-[#c03030] transition hover:border-[#e5b8b1] hover:bg-[#fff0ed]">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <Button className="mt-3 w-full justify-center" size="sm" variant="secondary" onClick={addIngredient}><Plus size={14} /> Add Ingredient</Button>
          </div>
        </Modal>
      )}

      {isRecipeManager && deleteTarget && (
        <ConfirmationModal title="Delete recipe?" confirmLabel="Delete Recipe" pendingLabel="Deleting..." pending={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeRecipe()}>
          Delete <strong>{deleteTarget.name}</strong>? Recipes already used by production requisitions cannot be deleted.
        </ConfirmationModal>
      )}
    </PageContainer>
  );
}

