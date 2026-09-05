import { useEffect, useState } from 'react';
import { Package, ShoppingCart, Truck, Factory, CheckCircle2, AlertTriangle, TrendingUp, Layers } from 'lucide-react';
import { api, selectedOrg } from '../../shared/api/http';
import { PageContainer } from '../../components/ui/PageContainer';
import { Notice } from '../../components/ui/Notice';

interface DashboardStats {
  totalRMProducts: number;
  totalFGProducts: number;
  pendingRequisitions: number;
  pendingDeliveries: number;
  activeBatches: number;
  pendingDispatches: number;
  lowStockCount: number;
  movements: any[];
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [message, setMessage] = useState('');
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
        const rmProds = products.data.filter((p) => p.type === 'RAW_MATERIAL');
        const fgProds = products.data.filter((p) => p.type === 'FINISHED_GOOD');
        const lowStock = products.data.filter((p) => p.isBelowReorder);
        setStats({
          totalRMProducts: rmProds.length,
          totalFGProducts: fgProds.length,
          pendingRequisitions: reqs.data.filter((r) => r.status === 'SUBMITTED' || r.status === 'APPROVED').length,
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
        { label: 'Raw Materials', value: stats.totalRMProducts, icon: Package, color: 'green', sub: 'Active SKUs' },
        { label: 'Finished Goods', value: stats.totalFGProducts, icon: Layers, color: 'blue', sub: 'Product lines' },
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
    <PageContainer
      cap="OPERATIONS OVERVIEW"
      title="Dashboard"
      description="Live feed production inventory snapshot across the entire workflow."
      notice={message ? <Notice variant={message.includes('select') ? 'warn' : 'error'}>{message}</Notice> : undefined}
    >

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          Loading dashboard...
        </div>
      )}

      {stats && (
        <>
          <div className="stats-grid">
            {statCards.map((card) => (
              <div className="stat-card" key={card.label}>
                <div className={`stat-card__icon stat-card__icon--${card.color}`}>
                  <card.icon />
                </div>
                <div className="stat-card__body">
                  <div className="stat-card__value">{card.value}</div>
                  <div className="stat-card__label">{card.label}</div>
                  <div className="stat-card__sub">{card.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="two-col" style={{ marginTop: 0 }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Recent Stock Movements</h2>
                  <p>Latest ledger activity from across all stores</p>
                </div>
                <TrendingUp size={20} style={{ color: 'var(--text-muted)' }} />
              </div>
              {stats.movements.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><CheckCircle2 size={28} /></div>
                  <b>No movements yet</b>
                  <p>Stock movements will appear once workflow transactions begin.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {stats.movements.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span className={`badge badge--${movementTypeColor[m.movementType] ?? 'gray'}`}>
                        <span className="badge__dot" />
                        {m.movementType?.replace(/_/g, ' ')}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {m.product?.name ?? m.productId?.slice(0, 8)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {Number(m.quantity).toLocaleString()} {m.uom?.code ?? 'kg'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 80, textAlign: 'right' }}>
                        {new Date(m.occurredAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Workflow Status</h2>
                  <p>End-to-end pipeline health at a glance</p>
                </div>
                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
              </div>
              {[
                { step: 'Sales Order → RM Requisition', status: 'ACTIVE', desc: 'Sales demand drives procurement planning' },
                { step: 'Supplier Challan → Weighbridge', status: 'ACTIVE', desc: 'Physical weight verification on vehicle arrival' },
                { step: 'RM Store 3-Way Verification', status: 'ACTIVE', desc: 'Requisition vs Challan vs Scale weight match' },
                { step: 'Recipe Scaling → FM Requisition', status: 'ACTIVE', desc: 'Auto-scale 1-Ton recipe for target production' },
                { step: 'Factory Batch → Waste Verification', status: 'ACTIVE', desc: 'Compare actual vs planned waste allowance' },
                { step: 'FM Store → Customer Dispatch', status: 'ACTIVE', desc: 'Complete genealogical dispatch traceability' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < 5 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--success-bg)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.step}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}


