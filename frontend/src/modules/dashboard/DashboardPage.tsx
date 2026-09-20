import { twMerge } from 'tailwind-merge';
import { useToastMessage } from "../../components/ui/Toast";
import { iconVariants, badgeVariants } from '../../shared/styles/variants';
import { Card } from '../../components/ui/Card';
import { useEffect, useState } from 'react';
import { ShoppingCart, Truck, Factory, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { api, selectedOrg } from '../../shared/api/http';
import { PageContainer } from '../../components/ui/PageContainer';

interface DashboardStats {
  pendingRequisitions: number;
  pendingDeliveries: number;
  activeBatches: number;
  pendingDispatches: number;
  lowStockCount: number;
  movements: any[];
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [, setMessage] = useToastMessage();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrg()) {
      setMessage('Please select an organisation to view the dashboard.');
      setLoading(false);
      return;
    }
    Promise.all([
      api<{ data: any[] }>('/products'),
      api<{ data: any[] }>('/purchase-requisitions'),
      api<{ data: any[] }>('/deliveries'),
      api<{ data: any[] }>('/batches'),
      api<{ data: any[] }>('/dispatches'),
      api<{ data: any[] }>('/inventory/movements'),
    ])
      .then(([products, reqs, deliveries, batches, dispatches, movements]) => {
        const lowStock = products.data.filter((p) => p.isBelowReorder);
        setStats({
          pendingRequisitions: reqs.data.filter((r) => r.status === 'PENDING' || r.status === 'AWAITING_DELIVERY').length,
          pendingDeliveries: deliveries.data.filter((d) => d.status === 'SUBMITTED').length,
          activeBatches: batches.data.filter((b) => b.status === 'DRAFT' || b.status === 'SUBMITTED').length,
          pendingDispatches: dispatches.data.filter((d) => d.status === 'SUBMITTED').length,
          lowStockCount: lowStock.length,
          movements: movements.data.slice(0, 8),
        });
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);

  const statCards = stats
    ? [
        { label: 'Open Requisitions', value: stats.pendingRequisitions, icon: ShoppingCart, color: 'yellow', sub: 'Awaiting supply' },
        { label: 'Pending Challans', value: stats.pendingDeliveries, icon: Truck, color: 'purple', sub: 'In transit' },
        { label: 'Active Batches', value: stats.activeBatches, icon: Factory, color: 'brand', sub: 'Production running' },
        { label: 'Low Stock Items', value: stats.lowStockCount, icon: AlertTriangle, color: stats.lowStockCount > 0 ? 'red' : 'green', sub: 'Below reorder level' },
      ]
    : [];

  const movementTypeColor: Record<string, string> = {
    RECEIPT: 'green', ISSUE: 'yellow', PRODUCTION_OUTPUT: 'blue',
    DISPATCH: 'purple', CONSUMPTION: 'red', ADJUSTMENT: 'gray',
  };

  return (
    <PageContainer loading={loading}
      cap="OPERATIONS OVERVIEW"
      title="Dashboard"
      description="Live feed production inventory snapshot across the entire workflow."
      headerContent={stats && (
        <div className="summary-grid grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {statCards.map((card) => (
            <Card tone={card.color} className="relative flex min-h-30 flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center [&>*]:relative [&>*]:z-10 after:pointer-events-none after:absolute after:-top-12 after:left-1/2 after:size-32 after:-translate-x-1/2 after:rounded-full after:bg-white/55 after:blur-xl transition-[box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(67,58,40,0.12)]" key={card.label}>
              <div className={twMerge(`grid size-10 shrink-0 place-items-center rounded-lg [:where(&_svg)]:size-5 ${iconVariants[card.color] ?? ""}`)}>
                <card.icon />
              </div>
              <div className="min-w-0">
                <div className="mb-1 [font-family:'Outfit',_sans-serif] text-2xl font-bold leading-none text-[#0f1c16]">{card.value}</div>
                <div className="text-xs font-medium text-[#7a9185]">{card.label}</div>
                <div className="mt-1 text-[11.5px] text-[#7a9185]">{card.sub}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
   >

      {stats && (
        <>
          <div className="grid grid-cols-[1fr_1.2fr] gap-5 max-[900px]:grid-cols-[1fr] mt-0">
            <Card>
              <div className="flex items-center justify-between gap-3 mb-5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-0">
                <div>
                  <h2>Recent Stock Movements</h2>
                  <p>Latest ledger activity from across all stores</p>
                </div>
                <TrendingUp size={20} className="text-[#7a9185]" />
              </div>
              {stats.movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70">
                  <div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><CheckCircle2 size={28} /></div>
                  <b>No movements yet</b>
                </div>
              ) : (
                <div className="grid gap-2">
                  {stats.movements.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-[10px_0] [border-bottom:1px_solid_#e0e5dd]">
                      <span className={twMerge(`inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap ${badgeVariants[movementTypeColor[m.movementType] ?? 'gray'] ?? ""}`)}>
                        <span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />
                        {m.movementType?.replace(/_/g, ' ')}
                      </span>
                      <span className="flex-1 text-[13px] text-[#445e50]">
                        {m.product?.name ?? m.productId?.slice(0, 8)}
                      </span>
                      <span className="text-[13px] font-semibold">
                        {Number(m.quantity).toLocaleString()} {m.uom?.code ?? 'kg'}
                      </span>
                      <span className="text-[11px] text-[#7a9185] min-w-20 text-right">
                        {new Date(m.occurredAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3 mb-5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-0">
                <div>
                  <h2>Workflow Status</h2>
                  <p>End-to-end pipeline health at a glance</p>
                </div>
                <CheckCircle2 size={20} className="text-[#1b8f5a]" />
              </div>
              {[
                { step: 'Sales Order → RM Requisition', status: 'ACTIVE', desc: 'Sales demand drives procurement planning' },
                { step: 'Supplier Challan → Weighbridge', status: 'ACTIVE', desc: 'Physical weight verification on vehicle arrival' },
                { step: 'RM Store 3-Way Verification', status: 'ACTIVE', desc: 'Requisition vs Challan vs Scale weight match' },
                { step: 'Recipe Scaling → FM Requisition', status: 'ACTIVE', desc: 'Auto-scale 1-Ton recipe for target production' },
                { step: 'Factory Batch → Waste Verification', status: 'ACTIVE', desc: 'Compare actual vs planned waste allowance' },
                { step: 'FM Store → Customer Dispatch', status: 'ACTIVE', desc: 'Complete genealogical dispatch traceability' },
              ].map((item, i) => (
                <div key={i} className={twMerge("flex gap-3 p-[11px_0]", (i < 5 ? "[border-bottom:1px_solid_#e0e5dd]" : "[border-bottom:none]"))}>
                  <div className="w-6 h-6 rounded-full bg-[#eaf8f0] grid place-items-center shrink-0 mt-0.25">
                    <CheckCircle2 size={14} className="text-[#1b8f5a]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">{item.step}</div>
                    <div className="text-[12px] text-[#7a9185] mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
