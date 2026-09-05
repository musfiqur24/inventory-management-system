import { useEffect, useState } from 'react';
import { Plus, Warehouse, Search, HardDrive, Factory } from 'lucide-react';
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

interface InventoryBalance {
  id: string;
  quantity: number;
  product?: { name: string; sku: string } | null;
  uom?: { code: string } | null;
}

interface Bin {
  id: string;
  code: string;
  name: string;
  warehouseType: 'RM_STORE' | 'FM_STORE' | 'SILO' | 'FACTORY_FLOOR';
  zone?: string | null;
  capacity?: number | null;
  currentOccupancy?: number;
  utilizationPercent?: number;
  balances?: InventoryBalance[];
}

export function BinsPage() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | 'RM_STORE' | 'FM_STORE' | 'SILO' | 'FACTORY_FLOOR'>('ALL');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    code: '',
    name: '',
    warehouseType: 'RM_STORE' as 'RM_STORE' | 'FM_STORE' | 'SILO' | 'FACTORY_FLOOR',
    zone: '',
    capacity: '',
  });

  const loadData = async () => {
    if (!selectedOrg()) return setMessage('Please select an organisation first.');
    try {
      const res = await api<{ data: Bin[] }>('/bins');
      setBins(res.data);
      setMessage('');
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const submit = async () => {
    try {
      if (!form.code || !form.name) {
        throw new Error('Bin Code and Name are required.');
      }

      await api('/bins', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.toUpperCase().trim(),
          name: form.name.trim(),
          warehouseType: form.warehouseType,
          zone: form.zone ? form.zone.trim() : undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
        }),
      });

      setOpen(false);
      setForm({ code: '', name: '', warehouseType: 'RM_STORE', zone: '', capacity: '' });
      void loadData();
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  const filteredBins = bins.filter((b) => {
    const matchesTab = tab === 'ALL' || b.warehouseType === tab;
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      (b.zone ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalBins = bins.length;
  const rmBins = bins.filter((b) => b.warehouseType === 'RM_STORE').length;
  const fmBins = bins.filter((b) => b.warehouseType === 'FM_STORE').length;
  const siloBins = bins.filter((b) => b.warehouseType === 'SILO').length;
  const totalCapacity = bins.reduce((sum, b) => sum + (b.capacity ? Number(b.capacity) : 0), 0);

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Warehouse Bins & Locations"
      description="Configure raw material silos, rack bins, factory staging bays, and finished good warehouse pallet slots."
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add Storage Bin
        </Button>
      }
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}>
            <Warehouse size={20} />
          </div>
          <div>
            <div className="stat-card__val">{totalBins}</div>
            <div className="stat-card__label">Total Registered Bins</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(24, 100, 171, 0.1)', color: '#1864ab' }}>
            <HardDrive size={20} />
          </div>
          <div>
            <div className="stat-card__val">{rmBins}</div>
            <div className="stat-card__label">RM Store Locations</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}>
            <HardDrive size={20} />
          </div>
          <div>
            <div className="stat-card__val">{siloBins}</div>
            <div className="stat-card__label">Bulk Silos</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(27, 143, 90, 0.1)', color: '#1b8f5a' }}>
            <Factory size={20} />
          </div>
          <div>
            <div className="stat-card__val">{totalCapacity > 0 ? `${(totalCapacity / 1000).toLocaleString()} Tons` : `${totalBins} Bays`}</div>
            <div className="stat-card__label">Total Storage Capacity</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div className="tabs">
            <button className={`tab ${tab === 'ALL' ? 'tab--active' : ''}`} onClick={() => setTab('ALL')}>
              All Bins ({totalBins})
            </button>
            <button className={`tab ${tab === 'RM_STORE' ? 'tab--active' : ''}`} onClick={() => setTab('RM_STORE')}>
              RM Store ({rmBins})
            </button>
            <button className={`tab ${tab === 'SILO' ? 'tab--active' : ''}`} onClick={() => setTab('SILO')}>
              Bulk Silos ({siloBins})
            </button>
            <button className={`tab ${tab === 'FM_STORE' ? 'tab--active' : ''}`} onClick={() => setTab('FM_STORE')}>
              FM Store ({fmBins})
            </button>
          </div>

          <div style={{ position: 'relative', minWidth: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <Input
              placeholder="Search bin code, name, zone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {/* Bins Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bin Code</th>
                <th>Bin Name</th>
                <th>Warehouse Type / Zone</th>
                <th>Max Capacity</th>
                <th>Current Occupancy</th>
                <th>Utilization</th>
                <th>Active Stock Balances</th>
              </tr>
            </thead>
            <tbody>
              {filteredBins.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No warehouse bins found. Click <strong>Add Storage Bin</strong> to register a new storage location.
                  </td>
                </tr>
              ) : (
                filteredBins.map((bin) => {
                  const cap = bin.capacity ? Number(bin.capacity) : 0;
                  const occ = bin.currentOccupancy ?? 0;
                  const pct = bin.utilizationPercent ?? 0;

                  return (
                    <tr key={bin.id}>
                      <td>
                        <code style={{ background: 'var(--bg-card-alt)', padding: '4px 8px', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                          {bin.code}
                        </code>
                      </td>
                      <td style={{ fontWeight: 600 }}>{bin.name}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {statusBadge(bin.warehouseType)}
                          {bin.zone && <span className="badge badge--secondary" style={{ fontSize: 11 }}>Zone: {bin.zone}</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{cap > 0 ? `${cap.toLocaleString()} kg` : 'Unlimited'}</td>
                      <td style={{ fontWeight: 700 }}>{occ.toLocaleString()} kg</td>
                      <td style={{ width: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-card-alt)', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, pct)}%`,
                                borderRadius: 4,
                                background: pct > 90 ? 'var(--error)' : pct > 75 ? '#c87d12' : 'var(--brand-primary)',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, width: 36 }}>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        {!bin.balances || bin.balances.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Empty</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {bin.balances.map((b) => (
                              <span key={b.id} className="badge badge--info" style={{ fontSize: 11 }}>
                                {b.product?.name ?? 'Item'}: {Number(b.quantity).toLocaleString()} {b.uom?.code ?? 'kg'}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Bin Modal */}
      {open && (
        <Modal
          title="Add Storage Bin / Silo"
          description="Register a new storage location for raw material put-away, silos, or finished goods warehouse racks."
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submit} disabled={!form.code || !form.name}>
                Save Storage Bin
              </Button>
            </>
          }
        >
          <div className="form-grid-2">
            <FormField label="Bin / Location Code" required hint="e.g. SILO-01, RACK-A-12, FM-PALLET-04">
              <Input placeholder="SILO-01" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>

            <FormField label="Location Name" required hint="Full descriptive title">
              <Input placeholder="Main Yellow Corn Silo 100T" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>

            <FormField label="Warehouse Zone / Type" required>
              <Select value={form.warehouseType} onChange={(e) => setForm({ ...form, warehouseType: e.target.value as any })}>
                <option value="RM_STORE">Raw Material Store (RM Rack / Floor)</option>
                <option value="SILO">Bulk Grain Silo (Corn / Soybean Silo)</option>
                <option value="FM_STORE">Finished Goods Store (FG Pallet Rack)</option>
                <option value="FACTORY_FLOOR">Factory Floor Staging Bay</option>
              </Select>
            </FormField>

            <FormField label="Zone Identifier" hint="e.g. Zone A, Silo Bay 2, Rack Line 3">
              <Input placeholder="Zone A" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
            </FormField>

            <FormField label="Maximum Storage Capacity (kg)" hint="Leave blank for unlimited open floor space">
              <Input type="number" placeholder="100000" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </FormField>
          </div>

          <Notice variant="info">
            Bins are used during supplier delivery receipt 3-way matching, factory material issues, and finished goods warehouse put-away.
          </Notice>
        </Modal>
      )}
    </PageContainer>
  );
}
