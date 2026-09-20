import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { api } from '../../shared/api/http';
import { usePageLoading } from '../../shared/hooks/usePageLoading';
import { useToastMessage } from '../../components/ui/Toast';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';

type Row = { id: string; batchNumber: string; completedAt?: string; fgProduct?: { name: string }; metrics: { rawMaterialCost: number; otherInputCost: number; operatingCost: number; totalCost: number; totalOutputQty: number; costPerKg: number; costPerTon: number; revenue: number; profit: number; profitPerKg: number; profitPerTon: number; marginPercent: number; salesPosted: boolean } };
const money = (value: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(value || 0);

export function ProfitLossPage() {
  const [loading, runLoad] = usePageLoading(), [, setMessage] = useToastMessage();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { void runLoad(async () => { try { const response = await api<{ data: Row[] }>('/batches'); setRows(response.data); } catch (error: any) { setMessage(error.message); } }); }, []);
  const cost = rows.reduce((sum, row) => sum + row.metrics.totalCost, 0), revenue = rows.reduce((sum, row) => sum + row.metrics.revenue, 0), profit = revenue - cost;
  return <PageContainer loading={loading} cap="REPORTS" title="Profit & Loss" description="Batch profitability calculated from Product setup amounts and posted sales prices.">
    <div className="mb-5 grid grid-cols-3 gap-4 max-[700px]:grid-cols-1"><Card className="p-5"><WalletCards className="mb-3 text-[#7a9185]"/><span className="text-xs text-[#7a9185]">Production cost</span><b className="block text-xl">{money(cost)}</b></Card><Card className="p-5"><TrendingUp className="mb-3 text-[#1b8f5a]"/><span className="text-xs text-[#7a9185]">Revenue</span><b className="block text-xl">{money(revenue)}</b></Card><Card className="p-5">{profit >= 0 ? <TrendingUp className="mb-3 text-[#1b8f5a]"/> : <TrendingDown className="mb-3 text-red-600"/>}<span className="text-xs text-[#7a9185]">Net profit / loss</span><b className={`block text-xl ${profit < 0 ? 'text-red-600' : 'text-[#1b8f5a]'}`}>{money(profit)}</b></Card></div>
    <Card className="p-0"><div className="border-b border-[#e0e5dd] p-5"><h2 className="font-bold">Batch profitability</h2><p className="text-xs text-[#7a9185]">Input cost uses each product's Amount. Revenue uses weighted sales price when available, otherwise the finished product Amount.</p></div><div className="overflow-x-auto"><DataTable columns={['Batch','Finished product','Output','RM cost','Other cost','Total cost','Cost / ton','Revenue','Profit / ton','Margin']} empty={rows.length === 0 && <div className="p-12 text-center text-[#7a9185]">No completed production batches.</div>}>{rows.map(row => <tr key={row.id}><td><strong className="font-mono">{row.batchNumber}</strong><div className="text-xs text-[#7a9185]">{row.completedAt ? new Date(row.completedAt).toLocaleDateString('en-GB') : '-'}</div></td><td>{row.fgProduct?.name ?? '-'}</td><td>{row.metrics.totalOutputQty.toLocaleString()}</td><td>{money(row.metrics.rawMaterialCost)}</td><td>{money(row.metrics.otherInputCost + row.metrics.operatingCost)}</td><td>{money(row.metrics.totalCost)}</td><td>{money(row.metrics.costPerTon)}</td><td>{money(row.metrics.revenue)}<div className="text-xs text-[#7a9185]">{row.metrics.salesPosted ? 'Sales rate' : 'Product amount'}</div></td><td className={row.metrics.profit < 0 ? 'font-bold text-red-600' : 'font-bold text-[#1b8f5a]'}>{money(row.metrics.profitPerTon)}</td><td>{row.metrics.marginPercent.toFixed(2)}%</td></tr>)}</DataTable></div></Card>
  </PageContainer>;
}
