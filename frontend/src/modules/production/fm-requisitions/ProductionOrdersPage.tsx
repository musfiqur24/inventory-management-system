import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import type { CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { Plus, Factory, Search, Eye, Trash2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { statusBadge } from '../../../components/ui/Badge';

interface ProductionOrder {
  id: string; number: string; requisitionNumber?: string; status: string; targetQty: number; expectedWastePercent: number; plannedStartDate?: string;
  recipe?: { id: string; name: string; code: string; targetTonnage: number } | null;
  fgProduct?: { name: string; sku: string } | null;
  uom?: { code: string } | null;
  lines: Array<{ id: string; rawMaterial?: { name: string; sku: string }; requiredQty: number; issuedQty: number; }>;
}
interface Product { id: string; name: string; sku: string; type: string; }
interface Recipe {
  id: string; name: string; code: string; targetTonnage: number;
  finishedProductId: string; outputUomId: string; outputQty: number;
  ingredients: Array<{
    id: string; rawProductId: string; percentage: number; quantityPerTon: number;
    rawMaterial?: { name: string; sku: string } | null;
  }>;
}

export function ProductionOrdersPage() {
  const [pageLoading, runPageLoad] = usePageLoading();
  const [rows, setRows] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [, setMessage] = useToastMessage();
  const [search, setSearch] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const load = async () => { return runPageLoad(async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [po, r, p] = await Promise.all([
        api<{ data: ProductionOrder[] }>('/production-orders'),
        api<{ data: Recipe[] }>('/recipes'),
        api<{ data: Product[] }>('/products'),
      ]);
      setRows(po.data); setRecipes(r.data); setFinishedGoods(p.data.filter((product) => product.type === 'FINISHED_GOOD')); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  });};

  useEffect(() => { void load(); }, []);

  const emptyItem = () => ({ finishedProductId: '', recipeId: '', targetQty: '', expectedWastePercent: '0', plannedStartDate: '' });
  const [items, setItems] = useState([emptyItem()]);

  const itemPreview = items.map((item) => {
    const recipe = recipes.find((candidate) => candidate.id === item.recipeId);
    const targetTons = Math.max(0, Number(item.targetQty) || 0);
    const wastePercent = Math.min(50, Math.max(0, Number(item.expectedWastePercent) || 0));
    return { ...item, recipe, targetTons, wastePercent, predictedOutput: targetTons * (1 - wastePercent / 100) };
  });
  const totalRmNeeded = itemPreview.reduce((total, item) => total + (item.recipe?.ingredients.reduce((sum, ingredient) => sum + Number(ingredient.quantityPerTon) * item.targetTons, 0) ?? 0), 0);
  const combinedRmBreakdown = (() => {
    const materials = new Map<string, { id: string; name: string; sku: string; quantity: number; finishedGoods: Set<string> }>();
    itemPreview.forEach((item) => {
      if (!item.recipe || item.targetTons <= 0) return;
      item.recipe.ingredients.forEach((ingredient) => {
        const current = materials.get(ingredient.rawProductId) ?? {
          id: ingredient.rawProductId,
          name: ingredient.rawMaterial?.name ?? 'Raw material',
          sku: ingredient.rawMaterial?.sku ?? '',
          quantity: 0,
          finishedGoods: new Set<string>(),
        };
        current.quantity += Number(ingredient.quantityPerTon) * item.targetTons;
        current.finishedGoods.add(item.recipe!.name);
        materials.set(ingredient.rawProductId, current);
      });
    });
    return [...materials.values()].sort((a, b) => b.quantity - a.quantity);
  })();

  const canCreate = itemPreview.length > 0 && itemPreview.every((item) => item.recipe && item.targetTons > 0 && item.plannedStartDate) && new Set(itemPreview.map((item) => item.recipe?.finishedProductId)).size === itemPreview.length;

  const submit = async () => {
    try {
      await api('/production-orders', {
        method: 'POST',
        body: JSON.stringify({
          items: itemPreview.map((item) => ({
            recipeId: item.recipeId,
            plannedQty: item.targetTons * 1000,
            expectedWastePercent: item.wastePercent,
            scheduledFor: item.plannedStartDate,
          })),
        }),
      });
      setOpen(false);
      setItems([emptyItem()]);
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const filtered = rows.filter((r) =>
    r.number.toLowerCase().includes(search.toLowerCase()) ||
    (r.requisitionNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (r.recipe?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedWastePercent = Number(selected?.expectedWastePercent ?? 0);
  const selectedWasteTons = Number(selected?.targetQty ?? 0) * (selectedWastePercent / 100);
  const selectedExpectedOutputTons = Math.max(0, Number(selected?.targetQty ?? 0) - selectedWasteTons);

  const requisitionCount = new Set(rows.map((row) => row.requisitionNumber ?? row.number)).size;

  const summaryCards = (
    <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
      {[{ label: 'Total Requisitions', v: requisitionCount, c: 'brand' }, { label: 'Draft', v: rows.filter((r) => r.status === 'DRAFT').length, c: 'gray' }, { label: 'Submitted', v: rows.filter((r) => r.status === 'SUBMITTED').length, c: 'blue' }, { label: 'Closed', v: rows.filter((r) => r.status === 'CLOSED').length, c: 'green' }].map((item) => (
        <Card tone={item.c} className="relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center [&>*]:relative [&>*]:z-10 after:pointer-events-none after:absolute after:-top-12 after:left-1/2 after:size-28 after:-translate-x-1/2 after:rounded-full after:bg-white/55 after:blur-xl" key={item.label}>
          <div><div className="font-['Outfit',sans-serif] text-[22px] font-bold leading-none text-[#0f1c16]">{item.v}</div><div className="mt-1 text-[12px] font-medium text-[#7a9185]">{item.label}</div></div>
        </Card>
      ))}
    </div>
  );

  return (
    <PageContainer loading={pageLoading}
      cap="PRODUCTION"
      title="FM Production Requisitions"
      description="Auto-scale recipe formulations for target production quantities. RM requirement lines are calculated from the recipe."
      actions={<Button variant="primary" onClick={() => { setItems([emptyItem()]); setOpen(true); }}><Plus size={16} /> New Production Requisition</Button>}
      headerContent={summaryCards}
   >

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Production Requisition Register</h2>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search orders…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <DataTable minRows={5} columns={["Requisition #","Recipe","FG Product","Target Qty","RM Lines","Status","Planned Start","Actions"]} empty={filtered.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Factory size={28} /></div><b>No production orders yet</b><p>Create an order to auto-scale a recipe to your target quantity.</p></div>}>
              {filtered.map((po) => (
                <tr key={po.id}>
                  <td><div><strong className="text-[#0d3b2e] font-mono">{po.requisitionNumber ?? po.number}</strong>{po.requisitionNumber && po.requisitionNumber !== po.number && <span className="mt-1 block text-[10px] text-[#7a9185]">FG line {po.number.slice(-2)}</span>}</div></td>
                  <td>{po.recipe?.name ?? '-'}</td>
                  <td>{po.fgProduct?.name ?? '-'}</td>
                  <td><strong>{Number(po.targetQty).toLocaleString()}</strong> T</td>
                  <td>{po.lines.length} materials</td>
                  <td>{statusBadge(po.status)}</td>
                  <td className="text-[12px] text-[#7a9185]">{po.plannedStartDate ? new Date(po.plannedStartDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td><Button size="sm" variant="secondary" className="size-9 min-h-9 p-0" title="View requirements" aria-label={`View requirements for ${po.number}`} onClick={() => setSelected(po)}><Eye size={15} /></Button></td>
                </tr>
              ))}
            </DataTable>
          
        </div>
      </Card>

      {open && (
        <Modal extraWide fixedHeight title="New Production Requisition" description="Select finished goods, confirm their linked recipes, and review calculated raw-material requirements before submission." onClose={() => { setOpen(false); setPreviewIndex(null); }}
          footer={<><Button variant="secondary" onClick={() => { setOpen(false); setPreviewIndex(null); }}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!canCreate}>Submit Requisition</Button></>}
        >
          <div className="overflow-x-auto rounded-md border border-[#d8e0d7]">
            <div className="min-w-[1210px]">
              <div className="grid grid-cols-[220px_205px_110px_100px_150px_105px_92px_40px] items-center gap-3 bg-[#f2f5f3] px-4 py-3 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#53665c]">
                <span>Finished good</span><span>Linked recipe</span><span>Target (T)</span><span>Waste %</span><span>Planned start</span><span>Expected</span><span>RM details</span><span />
              </div>
              {itemPreview.map((item, index) => {
                const duplicate = item.finishedProductId && items.some((other, otherIndex) => otherIndex !== index && other.finishedProductId === item.finishedProductId);
                return <div key={index} className="grid grid-cols-[220px_205px_110px_100px_150px_105px_92px_40px] items-center gap-3 border-t border-[#e0e5dd] bg-white px-4 py-3">
                  <Dropdown aria-label="Finished good" value={item.finishedProductId} onChange={(event) => { const linkedRecipe = recipes.find((recipe) => recipe.finishedProductId === event.target.value); setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, finishedProductId: event.target.value, recipeId: linkedRecipe?.id ?? "" } : line)); }}>
                    <option value="">Select finished good</option>
                    {finishedGoods.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </Dropdown>
                  <Input aria-label="Linked recipe" readOnly value={item.recipe?.code ?? (item.finishedProductId ? "No linked recipe" : "")} placeholder="Selected automatically" className={item.finishedProductId && !item.recipe ? "border-red-200! bg-red-50! text-red-700!" : "bg-[#f4f6f2]! text-[#52675d]!"} />
                  <Input aria-label="Target quantity in tons" type="number" min="0.001" step="0.001" placeholder="Tons" value={item.targetQty} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, targetQty: event.target.value } : line))} />
                  <Input aria-label="Expected waste percentage" type="number" min="0" max="50" step="0.01" placeholder="Waste %" value={item.expectedWastePercent} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, expectedWastePercent: event.target.value } : line))} />
                  <Input aria-label="Planned start date" type="date" value={item.plannedStartDate} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, plannedStartDate: event.target.value } : line))} />
                  <div className="rounded-md border border-[#d5e6d7] bg-[#edf8ef] px-3 py-2.5 text-center"><strong className="text-[14px] text-[#176b4b]">{item.predictedOutput.toLocaleString(undefined, { maximumFractionDigits: 4 })} T</strong></div>
                  <Button type="button" size="sm" variant="secondary" disabled={!item.recipe} onClick={() => setPreviewIndex(index)}><Eye size={14} /> View</Button>
                  <Button type="button" size="sm" variant="danger" className="size-10 p-0" disabled={items.length === 1} onClick={() => setItems(items.filter((_, lineIndex) => lineIndex !== index))} title="Remove finished good"><Trash2 size={15} /></Button>
                  {duplicate && <div className="col-span-8 -mt-1 text-[11px] font-medium text-[#c34838]">This finished good is already included.</div>}
                </div>;
              })}
            </div>
          </div>
          <Button type="button" className="mt-3 w-full justify-center" variant="secondary" onClick={() => setItems([...items, emptyItem()])}><Plus size={15} /> Add Finished Good</Button>
          <div className="mt-4 grid grid-cols-4 gap-3 max-[850px]:grid-cols-2 max-[500px]:grid-cols-1">
            <div className="rounded-md border border-[#dfe6dc] bg-[#f8faf7] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#7a9185]">Finished goods</span><strong className="mt-1 block text-lg">{items.length}</strong></div>
            <div className="rounded-md border border-[#dfe6dc] bg-[#f8faf7] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#7a9185]">Total production input</span><strong className="mt-1 block text-lg">{itemPreview.reduce((sum, item) => sum + item.targetTons, 0).toLocaleString()} T</strong></div>
            <div className="rounded-md border border-[#cfe4d5] bg-[#edf8ef] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#39704f]">Expected FG output</span><strong className="mt-1 block text-lg text-[#176b4b]">{itemPreview.reduce((sum, item) => sum + item.predictedOutput, 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} T</strong></div>
            <div className="rounded-md border border-[#dfd4b9] bg-[#fff8e9] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#916719]">Total RM needed</span><strong className="mt-1 block text-lg text-[#9a650d]">{totalRmNeeded.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong></div>
          </div>
          {combinedRmBreakdown.length > 0 && <div className="mt-4 overflow-hidden rounded-md border border-[#d8e0d7] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#dfe5dd] bg-[#f5f7f2] px-4 py-3"><div><strong className="text-[13px] text-[#173b30]">Combined Raw Material Breakdown</strong><p className="mt-0.5 text-[11px] text-[#75887e]">Aggregated requirement for every finished good in this requisition.</p></div><strong className="text-[14px] text-[#9a650d]">{totalRmNeeded.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg total</strong></div>
            <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(260px,1.5fr)_120px_100px] gap-3 border-b border-[#e0e5dd] bg-[#fafbf8] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.07em] text-[#66796f]"><span>Raw material</span><span>Used by finished goods</span><span className="text-right">Required</span><span className="text-right">Share</span></div>
            <div className="max-h-52 overflow-y-auto">
              {combinedRmBreakdown.map((material) => <div key={material.id} className="grid grid-cols-[minmax(220px,1.2fr)_minmax(260px,1.5fr)_120px_100px] items-center gap-3 border-b border-[#edf0eb] px-4 py-2.5 text-[12px] last:border-b-0">
                <div className="min-w-0"><strong className="block truncate text-[#243b30]">{material.name}</strong>{material.sku && <span className="block truncate text-[10px] text-[#829087]">{material.sku}</span>}</div>
                <span className="truncate text-[#5f7468]" title={[...material.finishedGoods].join(', ')}>{[...material.finishedGoods].join(', ')}</span>
                <strong className="text-right text-[#0d3b2e]">{material.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong>
                <span className="text-right font-semibold text-[#6b7f74]">{totalRmNeeded > 0 ? ((material.quantity / totalRmNeeded) * 100).toFixed(2) : '0.00'}%</span>
              </div>)}
            </div>
          </div>}
          {previewIndex !== null && itemPreview[previewIndex]?.recipe && (() => {
            const preview = itemPreview[previewIndex];
            const materialLines = preview.recipe!.ingredients.map((ingredient) => ({ ...ingredient, quantity: Number(ingredient.quantityPerTon) * preview.targetTons }));
            return <div className="fixed inset-0 z-120 flex justify-end bg-[#07130e]/35" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewIndex(null); }}>
              <aside className="flex h-full w-full max-w-xl flex-col border-l border-[#d9e1d8] bg-[#fffdf8] shadow-[-18px_0_55px_rgba(5,20,14,0.22)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e2e4dc] px-6 py-5">
                  <div><span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#53806b]">Raw material preview</span><h3 className="mt-1 font-['Outfit',sans-serif] text-xl font-bold">{preview.recipe!.name}</h3><p className="mt-1 text-xs text-[#6f8378]">Linked recipe: {preview.recipe!.code} · Target: {preview.targetTons.toLocaleString()} T</p></div>
                  <Button type="button" variant="secondary" size="sm" className="size-10 p-0" onClick={() => setPreviewIndex(null)} aria-label="Close raw material drawer">×</Button>
                </div>
                <div className="grid grid-cols-2 gap-3 border-b border-[#e2e4dc] bg-[#f6f8f3] px-6 py-4">
                  <div><span className="text-[10px] font-bold uppercase text-[#7a9185]">Total RM</span><strong className="mt-1 block text-lg">{materialLines.reduce((sum, line) => sum + line.quantity, 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong></div>
                  <div><span className="text-[10px] font-bold uppercase text-[#7a9185]">Materials</span><strong className="mt-1 block text-lg">{materialLines.length}</strong></div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="grid gap-2">
                    {materialLines.map((line) => <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_85px_125px] items-center gap-3 rounded-md border border-[#dfe6dc] bg-white px-4 py-3">
                      <div className="min-w-0"><strong className="block truncate text-[13px]">{line.rawMaterial?.name ?? 'Raw material'}</strong><span className="block truncate text-[10.5px] text-[#7a9185]">{line.rawMaterial?.sku ?? ''}</span></div>
                      <span className="text-right text-xs font-semibold text-[#52675d]">{Number(line.percentage).toFixed(2)}%</span>
                      <strong className="text-right text-[13px] text-[#0d3b2e]">{line.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong>
                    </div>)}
                  </div>
                </div>
                <div className="border-t border-[#e2e4dc] p-4 text-right"><Button type="button" variant="primary" onClick={() => setPreviewIndex(null)}>Done</Button></div>
              </aside>
            </div>;
          })()}
        </Modal>
      )}

      {selected && (
        <Modal title={`Order ${selected.number} - RM Requirements`} description={`Recipe: ${selected.recipe?.name ?? '-'} | Target: ${Number(selected.targetQty).toLocaleString()} T`} onClose={() => setSelected(null)} wide footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
          <div className="mb-5 grid grid-cols-3 gap-3 max-[650px]:grid-cols-1">
            <div className="rounded-lg border border-[#dfe6dc] bg-[#f8faf7] px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a9185]">Production Input</span>
              <strong className="mt-1 block text-lg text-[#263b31]">{Number(selected.targetQty).toLocaleString()} T</strong>
            </div>
            <div className="rounded-lg border border-[#eadcb9] bg-[#fff8e9] px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a6a17]">Predicted Waste ({selectedWastePercent.toFixed(2)}%)</span>
              <strong className="mt-1 block text-lg text-[#b06f08]">{selectedWasteTons.toLocaleString(undefined, { maximumFractionDigits: 4 })} T</strong>
            </div>
            <div className="rounded-lg border border-[#cfe4d5] bg-[#edf8ef] px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#39704f]">Expected FG Output</span>
              <strong className="mt-1 block text-lg text-[#0d5b3b]">{selectedExpectedOutputTons.toLocaleString(undefined, { maximumFractionDigits: 4 })} T</strong>
            </div>
          </div>
          <div className="overflow-x-auto">
            <DataTable columns={["Raw Material","SKU","Required Qty","Issued Qty","Remaining","Progress"]}>
                {selected.lines.map((l, i) => {
                  const pct = l.requiredQty > 0 ? Math.min((l.issuedQty / l.requiredQty) * 100, 100) : 0;
                  return (
                    <tr key={i}>
                      <td>{l.rawMaterial?.name ?? '—'}</td>
                      <td><span className="text-[11px] font-mono text-[#7a9185]">{l.rawMaterial?.sku}</span></td>
                      <td><strong>{Number(l.requiredQty).toLocaleString()}</strong></td>
                      <td>{Number(l.issuedQty).toLocaleString()}</td>
                      <td className={twMerge("font-semibold", (l.issuedQty >= l.requiredQty ? "text-[#1b8f5a]" : "text-[#c87d12]"))}>{Math.max(0, l.requiredQty - l.issuedQty).toLocaleString()}</td>
                      <td className="min-w-30">
                        <div className="h-1.5 rounded-[4px] bg-[#e0e5dd] overflow-hidden"><div className="h-full rounded-[4px] [background:linear-gradient(90deg,_#a8d548,_#1a5c45)] [transition:width_0.5s_ease] w-[var(--meter-width)]" style={{ "--meter-width": `${pct}%` } as CSSProperties} /></div>
                        <div className="text-[11px] text-[#7a9185] mt-0.75">{pct.toFixed(0)}%</div>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


