import { useEffect, useState } from 'react';
import { Search, Warehouse, Package, TrendingUp } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Notice } from '../../../components/ui/Notice';
import { Badge } from '../../../components/ui/Badge';

interface Lot {
  id: string; lotNumber: string; product?: { name: string; sku: string; type: string } | null;
  uom?: { code: string } | null; currentQty: number; receivedQty: number;
  receivedAt?: string; expiresAt?: string; binCode?: string; status?: string;
}

interface InventoryBalance {
  id: string; product?: { name: string; sku: string } | null;
  uom?: { code: string } | null; bin?: { code: string; name: string } | null;
  quantity: number; lot?: Lot | null;
}

export function RmStorePage() {
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'balances' | 'lots'>('balances');
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [bal, lt] = await Promise.all([
        api<{ data: InventoryBalance[] }>('/rm-store/balances'),
        api<{ data: Lot[] }>('/rm-store/lots'),
      ]);
      setBalances(bal.data); setLots(lt.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const totalQty = balances.reduce((s, b) => s + Number(b.quantity), 0);
  const skuCount = new Set(balances.map((b) => b.product?.sku)).size;
  const totalLots = lots.length;
  const activeLots = lots.filter((l) => (l.currentQty ?? 0) > 0).length;

  const filteredBal = balances.filter((b) =>
    (b.product?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (b.product?.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (b.bin?.code ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredLots = lots.filter((l) =>
    l.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
    (l.product?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer
      cap="INVENTORY"
      title="Raw Material Store"
      description="Live stock balances and lot-level traceability for all raw materials in RM warehouse bins."
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total RM Stock', value: `${totalQty.toLocaleString()} kg`, icon: TrendingUp, color: 'green' },
          { label: 'Active SKUs', value: skuCount, icon: Package, color: 'blue' },
          { label: 'Total Lots', value: totalLots, icon: Warehouse, color: 'purple' },
          { label: 'Active Lots', value: activeLots, icon: Package, color: 'brand' },
        ].map((s) => (
          <div className="stat-card" key={s.label} style={{ padding: '14px 16px' }}>
            <div className={`stat-card__icon stat-card__icon--${s.color}`}><s.icon size={18} /></div>
            <div className="stat-card__body">
              <div className="stat-card__value" style={{ fontSize: typeof s.value === 'string' ? 18 : 26 }}>{s.value}</div>
              <div className="stat-card__label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header">
          <div className="tabs" style={{ margin: 0, border: 'none' }}>
            <button className={`tab ${tab === 'balances' ? 'active' : ''}`} onClick={() => setTab('balances')}>
              <TrendingUp size={14} /> Stock Balances
            </button>
            <button className={`tab ${tab === 'lots' ? 'active' : ''}`} onClick={() => setTab('lots')}>
              <Package size={14} /> Lot Register
            </button>
          </div>
          <div className="search-bar">
            <Search size={15} /><input placeholder="Search product, bin, or lot…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {tab === 'balances' && (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Product</th><th>SKU</th><th>Bin</th><th>Lot</th><th>Quantity</th><th>UOM</th></tr></thead>
              <tbody>
                {filteredBal.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.product?.name ?? '—'}</strong></td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{b.product?.sku ?? '—'}</span></td>
                    <td>{b.bin ? <span className="badge badge--brand"><span className="badge__dot" />{b.bin.code}</span> : '—'}</td>
                    <td><span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{b.lot?.lotNumber ?? '—'}</span></td>
                    <td><strong style={{ fontSize: 15 }}>{Number(b.quantity).toLocaleString()}</strong></td>
                    <td>{b.uom?.code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBal.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Package size={28} /></div><b>No stock found</b><p>Stock balances appear once RM is received and put away.</p></div>}
          </div>
        )}

        {tab === 'lots' && (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Lot Number</th><th>Product</th><th>Received Qty</th><th>Current Qty</th><th>UOM</th><th>Received At</th><th>Status</th></tr></thead>
              <tbody>
                {filteredLots.map((l) => (
                  <tr key={l.id}>
                    <td><strong style={{ fontFamily: 'monospace', color: 'var(--brand-primary)' }}>{l.lotNumber}</strong></td>
                    <td>{l.product?.name ?? '—'}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.product?.sku}</span></td>
                    <td>{Number(l.receivedQty).toLocaleString()}</td>
                    <td><strong>{Number(l.currentQty).toLocaleString()}</strong></td>
                    <td>{l.uom?.code ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.receivedAt ? new Date(l.receivedAt).toLocaleDateString('en-GB') : '—'}</td>
                    <td>
                      {Number(l.currentQty) > 0
                        ? <Badge variant="green">Active</Badge>
                        : <Badge variant="gray">Consumed</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLots.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Warehouse size={28} /></div><b>No lots yet</b><p>Lots are created when deliveries are received and verified.</p></div>}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

