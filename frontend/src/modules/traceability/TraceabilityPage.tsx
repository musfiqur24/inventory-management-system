import { PageSkeleton, useMinimumLoading } from "../../components/ui/Skeleton";
import { twMerge } from 'tailwind-merge';
import { useToastMessage } from "../../components/ui/Toast";
import { iconVariants, badgeVariants } from '../../shared/styles/variants';
import { useState } from 'react';
import { Search, GitBranch, Package, Truck, Factory, ArrowRight } from 'lucide-react';
import { api, selectedOrg } from '../../shared/api/http';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Dropdown } from '../../components/ui/Dropdown';

type TraceType = 'lot' | 'requisition' | 'batch' | 'dispatch';

interface TraceStep {
  type: string; label: string; id: string; date?: string;
  details: Record<string, string | number | null | undefined>;
  status: string;
}

interface TraceResult {
  traceId: string; traceType: string;
  chain: TraceStep[];
}

const STEP_ICONS: Record<string, any> = {
  REQUISITION: Package, DELIVERY: Truck, WEIGHMENT: Search,
  PRODUCTION_ORDER: Factory, BATCH: Factory, DISPATCH: Truck,
};

const STEP_COLORS: Record<string, string> = {
  REQUISITION: 'blue', DELIVERY: 'purple', WEIGHMENT: 'brand',
  PRODUCTION_ORDER: 'yellow', BATCH: 'green', DISPATCH: 'purple',
};

export function TraceabilityPage() {
  const [query, setQuery] = useState('');
  const [traceType, setTraceType] = useState<TraceType>('lot');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useMinimumLoading(loading);
  const [, setMessage] = useToastMessage();

  const trace = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    if (!query.trim()) return setMessage('Enter a lot number, requisition ID, or other reference.');
    setLoading(true); setMessage(''); setResult(null);
    try {
      const res = await api<TraceResult>(`/traceability/${traceType}/${encodeURIComponent(query.trim())}`);
      setResult(res);
    } catch (e: any) { setMessage(`Not found: ${e.message}`); }
    setLoading(false);
  };

  return (
    <PageContainer
      cap="TRACEABILITY"
      title="Full Chain Traceability"
      description="Trace any lot, requisition, or dispatch through the complete supply chain — from raw material to customer delivery."
   >

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-0"><h2>Trace Lookup</h2></div>
        <div className="grid grid-cols-[140px_1fr_auto] gap-3 items-end">
          <FormField label="Trace By">
            <Dropdown value={traceType} onChange={(e) => setTraceType(e.target.value as TraceType)}>
              <option value="lot">Lot Number</option>
              <option value="requisition">Requisition</option>
              <option value="batch">Batch Number</option>
              <option value="dispatch">Dispatch #</option>
            </Dropdown>
          </FormField>
          <FormField label="Reference ID or Number">
            <Input
              placeholder={traceType === 'lot' ? 'e.g. LOT-2026-0001' : 'Enter reference…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void trace(); }}
            />
          </FormField>
          <Button variant="primary" onClick={trace} disabled={loading}>
            <GitBranch size={16} /> {loading ? 'Tracing…' : 'Trace'}
          </Button>
        </div>
      </Card>

      {showSkeleton && <PageSkeleton/>}
      {!showSkeleton && result && (
        <div className="grid grid-cols-[1fr_1.2fr] gap-5 max-[900px]:grid-cols-[1fr] items-start">
          {/* Timeline */}
          <div>
            <div className="mb-4">
              <h2 className="text-[16px] font-bold">
                Chain for <span className="text-[#1a5c45] font-mono">{result.traceId}</span>
              </h2>
              <p className="text-[13px] text-[#7a9185] m-[4px_0_0]">
                {result.chain.length} events found across the supply chain
              </p>
            </div>

            <div className="relative pl-7 [&::before]:[content:''] [&::before]:absolute [&::before]:left-3 [&::before]:top-2 [&::before]:bottom-2 [&::before]:w-0.5 [&::before]:bg-[#e0e5dd]">
              {result.chain.map((step, i) => {
                const Icon = STEP_ICONS[step.type] ?? Package;
                const color = STEP_COLORS[step.type] ?? 'gray';
                return (
                  <div key={i} className={twMerge(`relative mb-5 [&::before]:[content:''] [&::before]:absolute [&::before]:-left-6 [&::before]:top-3 [&::before]:w-3 [&::before]:h-3 [&::before]:rounded-full [&::before]:bg-[#c5cec1] [&::before]:[border:2px_solid_#ffffff] [&.active::before]:bg-[#a8d548] [&.completed::before]:bg-[#1b8f5a] ${(i < result.chain.length - 1 ? "completed" : "active")}`)}>
                    <Card className="rounded-xl p-[14px_16px] shadow-none transition-shadow duration-150 hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className={twMerge(`w-11 h-11 rounded-[8px] grid place-items-center shrink-0 [:where(&_svg)]:w-5 [:where(&_svg)]:h-5 ${iconVariants[color] ?? ""}`, "w-9 h-9 rounded-[8px]")}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-bold tracking-[0.10em] uppercase text-[#7a9185] mb-1">{step.type.replace(/_/g, ' ')}</div>
                          <div className="text-[14px] font-semibold">{step.label}</div>
                          {step.date && (
                            <div className="text-[12.5px] text-[#7a9185] mt-1">{new Date(step.date).toLocaleString('en-GB')}</div>
                          )}
                        </div>
                        {i < result.chain.length - 1 && (
                          <ArrowRight size={14} className="text-[#7a9185] mt-1 shrink-0" />
                        )}
                      </div>

                      {/* Detail pills */}
                      {Object.keys(step.details).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {Object.entries(step.details).map(([k, v]) =>
                            v != null ? (
                              <div key={k} className="bg-[#f3f5f2] rounded-[6px] p-[3px_8px] text-[11.5px]">
                                <span className="text-[#7a9185] font-semibold">{k.replace(/([A-Z])/g, ' $1').trim()}: </span>
                                <span className="font-semibold">{String(v)}</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary card */}
          <Card>
            <div className="flex items-center justify-between gap-3 mb-5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-0"><h2>Trace Summary</h2></div>
            <div className="grid gap-3">
              <div>
                <div className="text-[11px] font-bold text-[#7a9185] tracking-[0.08em] uppercase mb-1">Reference</div>
                <div className="font-mono font-bold text-[16px] text-[#0d3b2e]">{result.traceId}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#7a9185] tracking-[0.08em] uppercase mb-1">Trace Type</div>
                <div className="font-semibold [text-transform:capitalize]">{result.traceType}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#7a9185] tracking-[0.08em] uppercase mb-1">Chain Length</div>
                <div className="font-bold text-[22px]">{result.chain.length} events</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#7a9185] tracking-[0.08em] uppercase mb-2">Event Types</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(result.chain.map((s) => s.type))].map((t) => (
                    <span key={t} className={twMerge(`inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap ${badgeVariants[STEP_COLORS[t] ?? 'gray'] ?? ""}`)}>
                      <span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />{t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!result && !showSkeleton && (
        <div className="mt-8">
          <Card className="[background:linear-gradient(135deg,_#0d3b2e,_#1a5c45)] [border:none] text-[#fff] text-center p-12">
            <GitBranch size={48} className="text-[#a8d548] mb-4" />
            <h2 className="[font-family:'Outfit',_sans-serif] text-[24px] m-[0_0_10px] text-[#fff]">Trace Any Record</h2>
            <p className="text-[rgba(255,255,255,0.65)] max-w-95 m-[0_auto] text-[14px]">
              Enter a lot number, requisition ID, batch number, or dispatch reference above to trace the complete genealogical chain — from raw material supplier right through to customer delivery.
            </p>
            <div className="flex justify-center gap-4 mt-7 flex-wrap">
              {['Supplier → RM Store', 'Weighbridge → Lot', 'Recipe → Batch', 'Batch → Dispatch'].map((s) => (
                <div key={s} className="bg-[rgba(255,255,255,0.1)] rounded-[8px] p-[8px_14px] text-[13px] font-semibold flex items-center gap-1.5">
                  <ArrowRight size={13} /> {s}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}


