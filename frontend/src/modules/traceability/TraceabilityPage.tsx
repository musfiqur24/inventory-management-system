import { useState } from 'react';
import { Search, GitBranch, Package, Truck, Factory, ArrowRight } from 'lucide-react';
import { api, selectedOrg } from '../../shared/api/http';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Notice } from '../../components/ui/Notice';

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
  const [message, setMessage] = useState('');

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
      notice={message ? <Notice variant={message.startsWith('Not found') ? 'error' : 'warn'}>{message}</Notice> : undefined}
    >

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h2>Trace Lookup</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <FormField label="Trace By">
            <Select value={traceType} onChange={(e) => setTraceType(e.target.value as TraceType)}>
              <option value="lot">Lot Number</option>
              <option value="requisition">Requisition</option>
              <option value="batch">Batch Number</option>
              <option value="dispatch">Dispatch #</option>
            </Select>
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
      </div>

      {result && (
        <div className="two-col" style={{ alignItems: 'flex-start' }}>
          {/* Timeline */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                Chain for <span style={{ color: 'var(--brand-secondary)', fontFamily: 'monospace' }}>{result.traceId}</span>
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {result.chain.length} events found across the supply chain
              </p>
            </div>

            <div className="trace-timeline">
              {result.chain.map((step, i) => {
                const Icon = STEP_ICONS[step.type] ?? Package;
                const color = STEP_COLORS[step.type] ?? 'gray';
                return (
                  <div key={i} className={`trace-step ${i < result.chain.length - 1 ? 'completed' : 'active'}`}>
                    <div className="trace-card">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div className={`stat-card__icon stat-card__icon--${color}`} style={{ width: 36, height: 36, borderRadius: 8 }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="trace-card__type">{step.type.replace(/_/g, ' ')}</div>
                          <div className="trace-card__title">{step.label}</div>
                          {step.date && (
                            <div className="trace-card__sub">{new Date(step.date).toLocaleString('en-GB')}</div>
                          )}
                        </div>
                        {i < result.chain.length - 1 && (
                          <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginTop: 4, flexShrink: 0 }} />
                        )}
                      </div>

                      {/* Detail pills */}
                      {Object.keys(step.details).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {Object.entries(step.details).map(([k, v]) =>
                            v != null ? (
                              <div key={k} style={{ background: 'var(--bg-base)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5 }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k.replace(/([A-Z])/g, ' $1').trim()}: </span>
                                <span style={{ fontWeight: 600 }}>{String(v)}</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary card */}
          <div className="card">
            <div className="card-header"><h2>Trace Summary</h2></div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--brand-primary)' }}>{result.traceId}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Trace Type</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{result.traceType}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Chain Length</div>
                <div style={{ fontWeight: 700, fontSize: 22 }}>{result.chain.length} events</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Event Types</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[...new Set(result.chain.map((s) => s.type))].map((t) => (
                    <span key={t} className={`badge badge--${STEP_COLORS[t] ?? 'gray'}`}>
                      <span className="badge__dot" />{t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div style={{ marginTop: 32 }}>
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', border: 'none', color: '#fff', textAlign: 'center', padding: 48 }}>
            <GitBranch size={48} style={{ color: 'var(--brand-accent)', marginBottom: 16 }} />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, margin: '0 0 10px', color: '#fff' }}>Trace Any Record</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 380, margin: '0 auto', fontSize: 14 }}>
              Enter a lot number, requisition ID, batch number, or dispatch reference above to trace the complete genealogical chain — from raw material supplier right through to customer delivery.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 28, flexWrap: 'wrap' }}>
              {['Supplier → RM Store', 'Weighbridge → Lot', 'Recipe → Batch', 'Batch → Dispatch'].map((s) => (
                <div key={s} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowRight size={13} /> {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}


