import type { CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';
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
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] gap-4 mb-6 max-[900px]:grid-cols-[repeat(2,_1fr)] max-[480px]:grid-cols-[1fr]">
        <Card className="flex items-start gap-3.5 p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md">
          <div className="w-11 h-11 rounded-[8px] grid place-items-center shrink-0 [:where(&_svg)]:w-5 [:where(&_svg)]:h-5 bg-[rgba(168,213,72,0.18)] text-[#0d3b2e]">
            <Warehouse size={20} />
          </div>
          <div>
            <div className="[font-family:'Outfit',_sans-serif] text-[26px] font-bold text-[#0f1c16] leading-[1] mb-1">{totalBins}</div>
            <div className="text-[12px] text-[#7a9185] font-medium">Total Registered Bins</div>
          </div>
        </Card>

        <Card className="flex items-start gap-3.5 p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md">
          <div className="w-11 h-11 rounded-[8px] grid place-items-center shrink-0 [:where(&_svg)]:w-5 [:where(&_svg)]:h-5 bg-[rgba(24,_100,_171,_0.1)] text-[#1864ab]">
            <HardDrive size={20} />
          </div>
          <div>
            <div className="[font-family:'Outfit',_sans-serif] text-[26px] font-bold text-[#0f1c16] leading-[1] mb-1">{rmBins}</div>
            <div className="text-[12px] text-[#7a9185] font-medium">RM Store Locations</div>
          </div>
        </Card>

        <Card className="flex items-start gap-3.5 p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md">
          <div className="w-11 h-11 rounded-[8px] grid place-items-center shrink-0 [:where(&_svg)]:w-5 [:where(&_svg)]:h-5 bg-[rgba(124,_58,_237,_0.1)] text-[#7c3aed]">
            <HardDrive size={20} />
          </div>
          <div>
            <div className="[font-family:'Outfit',_sans-serif] text-[26px] font-bold text-[#0f1c16] leading-[1] mb-1">{siloBins}</div>
            <div className="text-[12px] text-[#7a9185] font-medium">Bulk Silos</div>
          </div>
        </Card>

        <Card className="flex items-start gap-3.5 p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md">
          <div className="w-11 h-11 rounded-[8px] grid place-items-center shrink-0 [:where(&_svg)]:w-5 [:where(&_svg)]:h-5 bg-[rgba(27,_143,_90,_0.1)] text-[#1b8f5a]">
            <Factory size={20} />
          </div>
          <div>
            <div className="[font-family:'Outfit',_sans-serif] text-[26px] font-bold text-[#0f1c16] leading-[1] mb-1">{totalCapacity > 0 ? `${(totalCapacity / 1000).toLocaleString()} Tons` : `${totalBins} Bays`}</div>
            <div className="text-[12px] text-[#7a9185] font-medium">Total Storage Capacity</div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex gap-1 [border-bottom:2px_solid_#e0e5dd] mb-6 max-[480px]:overflow-x-auto max-[480px]:flex-nowrap">
            <button className={twMerge(`p-[10px_18px] [border:0] [background:none] text-[#7a9185] [font:600_13.5px_'Inter',_sans-serif] cursor-pointer [border-bottom:2px_solid_transparent] -mb-0.5 rounded-[8px_8px_0_0] [transition:all_0.15s] flex items-center gap-1.75 [:where(&_svg)]:w-3.75 [:where(&_svg)]:h-3.75 [&:hover]:text-[#445e50] [&:hover]:bg-[#f3f5f2] [&.active]:text-[#0d3b2e] [&.active]:[border-bottom-color:#0d3b2e] ${(tab === 'ALL' ? "text-[#0d3b2e] [border-bottom-color:#0d3b2e]" : "")}`)} onClick={() => setTab('ALL')}>
              All Bins ({totalBins})
            </button>
            <button className={twMerge(`p-[10px_18px] [border:0] [background:none] text-[#7a9185] [font:600_13.5px_'Inter',_sans-serif] cursor-pointer [border-bottom:2px_solid_transparent] -mb-0.5 rounded-[8px_8px_0_0] [transition:all_0.15s] flex items-center gap-1.75 [:where(&_svg)]:w-3.75 [:where(&_svg)]:h-3.75 [&:hover]:text-[#445e50] [&:hover]:bg-[#f3f5f2] [&.active]:text-[#0d3b2e] [&.active]:[border-bottom-color:#0d3b2e] ${(tab === 'RM_STORE' ? "text-[#0d3b2e] [border-bottom-color:#0d3b2e]" : "")}`)} onClick={() => setTab('RM_STORE')}>
              RM Store ({rmBins})
            </button>
            <button className={twMerge(`p-[10px_18px] [border:0] [background:none] text-[#7a9185] [font:600_13.5px_'Inter',_sans-serif] cursor-pointer [border-bottom:2px_solid_transparent] -mb-0.5 rounded-[8px_8px_0_0] [transition:all_0.15s] flex items-center gap-1.75 [:where(&_svg)]:w-3.75 [:where(&_svg)]:h-3.75 [&:hover]:text-[#445e50] [&:hover]:bg-[#f3f5f2] [&.active]:text-[#0d3b2e] [&.active]:[border-bottom-color:#0d3b2e] ${(tab === 'SILO' ? "text-[#0d3b2e] [border-bottom-color:#0d3b2e]" : "")}`)} onClick={() => setTab('SILO')}>
              Bulk Silos ({siloBins})
            </button>
            <button className={twMerge(`p-[10px_18px] [border:0] [background:none] text-[#7a9185] [font:600_13.5px_'Inter',_sans-serif] cursor-pointer [border-bottom:2px_solid_transparent] -mb-0.5 rounded-[8px_8px_0_0] [transition:all_0.15s] flex items-center gap-1.75 [:where(&_svg)]:w-3.75 [:where(&_svg)]:h-3.75 [&:hover]:text-[#445e50] [&:hover]:bg-[#f3f5f2] [&.active]:text-[#0d3b2e] [&.active]:[border-bottom-color:#0d3b2e] ${(tab === 'FM_STORE' ? "text-[#0d3b2e] [border-bottom-color:#0d3b2e]" : "")}`)} onClick={() => setTab('FM_STORE')}>
              FM Store ({fmBins})
            </button>
          </div>

          <div className="relative min-w-65">
            <Search size={16} className="absolute left-3 top-3 text-[#7a9185]" />
            <Input
              placeholder="Search bin code, name, zone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
               className="pl-9"
            />
          </div>
        </div>

        {/* Bins Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse [:where(&_th)]:p-[10px_16px] [:where(&_th)]:text-left [:where(&_th)]:text-[11px] [:where(&_th)]:font-bold [:where(&_th)]:tracking-[0.07em] [:where(&_th)]:uppercase [:where(&_th)]:text-[#7a9185] [:where(&_th)]:bg-[#f8faf7] [:where(&_th)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:p-[13px_16px] [:where(&_td)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:text-[13.5px] [:where(&_td)]:text-[#0f1c16] [&_tbody_tr]:[transition:background_0.1s] [&_tbody_tr:hover]:bg-[#f8faf7] [&_tbody_tr:last-child_td]:[border-bottom:0]">
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
                  <td colSpan={7} className="text-center p-8 text-[#7a9185]">
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
                        <code className="bg-[#f8faf7] p-[4px_8px] rounded-[6px] font-bold text-[13px]">
                          {bin.code}
                        </code>
                      </td>
                      <td className="font-semibold">{bin.name}</td>
                      <td>
                        <div className="flex gap-1.5 items-center">
                          {statusBadge(bin.warehouseType)}
                          {bin.zone && <span className="bg-[#f0f2ee] text-[#7a9185] inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap">Zone: {bin.zone}</span>}
                        </div>
                      </td>
                      <td className="font-semibold">{cap > 0 ? `${cap.toLocaleString()} kg` : 'Unlimited'}</td>
                      <td className="font-bold">{occ.toLocaleString()} kg</td>
                      <td className="w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-[4px] bg-[#f8faf7] overflow-hidden">
                            <div
                              style={{ "--meter-width": `${Math.min(100, pct)}%` } as CSSProperties} className={twMerge(twMerge("h-full rounded-[4px]", (pct > 90 ? "bg-[#c03030]" : (pct > 75 ? "bg-[#c87d12]" : "bg-[#0d3b2e]"))), "w-[var(--meter-width)]")}
                            />
                          </div>
                          <span className="text-[12px] font-bold w-9">{pct}%</span>
                        </div>
                      </td>
                      <td>
                        {!bin.balances || bin.balances.length === 0 ? (
                          <span className="text-[12px] text-[#7a9185]">Empty</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {bin.balances.map((b) => (
                              <span key={b.id} className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap bg-[#e8f2ff] text-[#1864ab]">
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
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 max-[640px]:grid-cols-[1fr]">
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
