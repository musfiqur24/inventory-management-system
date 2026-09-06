import { DataTable } from "../../../components/ui/DataTable";
import { twMerge } from 'tailwind-merge';
import { iconVariants } from '../../../shared/styles/variants';
import { useEffect, useState } from 'react';
import { Search, PackageCheck, TrendingUp, Package } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Notice } from '../../../components/ui/Notice';
import { Badge } from '../../../components/ui/Badge';

interface FmBalance {
  id: string;
  product?: { name: string; sku: string } | null;
  uom?: { code: string } | null;
  bin?: { code: string; name: string } | null;
  quantity: number;
  lot?: { lotNumber: string; receivedAt?: string } | null;
}

interface FmLot {
  id: string; lotNumber: string;
  product?: { name: string; sku: string } | null;
  uom?: { code: string } | null;
  currentQty: number; receivedQty: number;
  receivedAt?: string;
}

export function FmStorePage() {
  const [balances, setBalances] = useState<FmBalance[]>([]);
  const [lots, setLots] = useState<FmLot[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'balances' | 'lots'>('balances');
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [bal, lt] = await Promise.all([
        api<{ data: FmBalance[] }>('/fm-store/balances'),
        api<{ data: FmLot[] }>('/fm-store/lots'),
      ]);
      setBalances(bal.data); setLots(lt.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const totalQty = balances.reduce((s, b) => s + Number(b.quantity), 0);
  const skuCount = new Set(balances.map((b) => b.product?.sku)).size;

  const filteredBal = balances.filter((b) =>
    (b.product?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (b.bin?.code ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredLots = lots.filter((l) =>
    l.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
    (l.product?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer
      cap="INVENTORY"
      title="Finished Goods Store"
      description="Live FG stock balances and batch lot tracking, ready for customer dispatch."
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
   >
      <div className="grid grid-cols-[repeat(4,_1fr)] gap-4 mb-5 max-[900px]:grid-cols-[repeat(2,_1fr)] max-[480px]:grid-cols-[1fr]">
        {[
          { label: 'Total FG Stock', value: `${totalQty.toLocaleString()} kg`, icon: TrendingUp, color: 'green' },
          { label: 'Active SKUs', value: skuCount, icon: Package, color: 'blue' },
          { label: 'Total Batches', value: lots.length, icon: PackageCheck, color: 'purple' },
          { label: 'Active Batches', value: lots.filter((l) => l.currentQty > 0).length, icon: PackageCheck, color: 'brand' },
        ].map((s) => (
          <Card className="flex items-start gap-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md p-[14px_16px]" key={s.label}>
            <div className={twMerge(`w-11 h-11 rounded-[8px] grid place-items-center shrink-0 [:where(&_svg)]:w-5 [:where(&_svg)]:h-5 ${iconVariants[s.color] ?? ""}`)}><s.icon size={18} /></div>
            <div className="min-w-0">
              <div className={twMerge("[font-family:'Outfit',_sans-serif] text-[26px] font-bold text-[#0f1c16] leading-[1] mb-1", (typeof s.value === 'string' ? "text-[16px]" : "text-[26px]"))} >{s.value}</div>
              <div className="text-[12px] text-[#7a9185] font-medium">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <div className="flex gap-1 [border-bottom:2px_solid_#e0e5dd] max-[480px]:overflow-x-auto max-[480px]:flex-nowrap m-0 [border:none]">
            <button className={twMerge(`p-[10px_18px] [border:0] [background:none] text-[#7a9185] [font:600_13.5px_'Inter',_sans-serif] cursor-pointer [border-bottom:2px_solid_transparent] -mb-0.5 rounded-[8px_8px_0_0] [transition:all_0.15s] flex items-center gap-1.75 [:where(&_svg)]:w-3.75 [:where(&_svg)]:h-3.75 [&:hover]:text-[#445e50] [&:hover]:bg-[#f3f5f2] [&.active]:text-[#0d3b2e] [&.active]:[border-bottom-color:#0d3b2e] ${(tab === 'balances' ? "active" : "")}`)} onClick={() => setTab('balances')}><TrendingUp size={14} /> Stock Balances</button>
            <button className={twMerge(`p-[10px_18px] [border:0] [background:none] text-[#7a9185] [font:600_13.5px_'Inter',_sans-serif] cursor-pointer [border-bottom:2px_solid_transparent] -mb-0.5 rounded-[8px_8px_0_0] [transition:all_0.15s] flex items-center gap-1.75 [:where(&_svg)]:w-3.75 [:where(&_svg)]:h-3.75 [&:hover]:text-[#445e50] [&:hover]:bg-[#f3f5f2] [&.active]:text-[#0d3b2e] [&.active]:[border-bottom-color:#0d3b2e] ${(tab === 'lots' ? "active" : "")}`)} onClick={() => setTab('lots')}><Package size={14} /> Batch Lots</button>
          </div>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>

        {tab === 'balances' && (
          <div className="overflow-x-auto">
            <DataTable columns={["FG Product","SKU","Bin","Batch","Quantity","UOM"]}>
                {filteredBal.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.product?.name ?? '—'}</strong></td>
                    <td><span className="font-mono text-[11px] text-[#7a9185]">{b.product?.sku ?? '—'}</span></td>
                    <td>{b.bin ? <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#e8f2ff] text-[#1864ab]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />{b.bin.code}</span> : '—'}</td>
                    <td><span className="text-[11px] font-mono text-[#7a9185]">{b.lot?.lotNumber ?? '—'}</span></td>
                    <td><strong className="text-[15px]">{Number(b.quantity).toLocaleString()}</strong></td>
                    <td>{b.uom?.code ?? '—'}</td>
                  </tr>
                ))}
              </DataTable>
            {filteredBal.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><PackageCheck size={28} /></div><b>No FG stock</b><p>Finished goods will appear after production batches are closed.</p></div>}
          </div>
        )}

        {tab === 'lots' && (
          <div className="overflow-x-auto">
            <DataTable columns={["Batch Lot","FG Product","Produced Qty","Current Qty","UOM","Date","Status"]}>
                {filteredLots.map((l) => (
                  <tr key={l.id}>
                    <td><strong className="font-mono text-[#0d3b2e]">{l.lotNumber}</strong></td>
                    <td>{l.product?.name ?? '—'}<br /><span className="text-[11px] font-mono text-[#7a9185]">{l.product?.sku}</span></td>
                    <td>{Number(l.receivedQty).toLocaleString()}</td>
                    <td><strong>{Number(l.currentQty).toLocaleString()}</strong></td>
                    <td>{l.uom?.code ?? '—'}</td>
                    <td className="text-[12px] text-[#7a9185]">{l.receivedAt ? new Date(l.receivedAt).toLocaleDateString('en-GB') : '—'}</td>
                    <td>{Number(l.currentQty) > 0 ? <Badge variant="green">Available</Badge> : <Badge variant="gray">Dispatched</Badge>}</td>
                  </tr>
                ))}
              </DataTable>
            {filteredLots.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><PackageCheck size={28} /></div><b>No batches yet</b><p>FG lots appear when production batches are completed.</p></div>}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

