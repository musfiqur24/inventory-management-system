import { useEffect, useState } from "react";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Search,
  CircleDashed,
} from "lucide-react";
import { api, selectedOrg } from "../../../shared/api/http";
import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import { appToast, useToastMessage } from "../../../components/ui/Toast";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { Dropdown } from "../../../components/ui/Dropdown";

type QueueLine = {
  id: string;
  declaredQty: number | string;
  requisitionQty: number;
  previouslyVerifiedQty: number;
  remainingQty: number;
  product?: { name: string; sku: string };
  uom?: { code: string };
};
type QueueItem = {
  id: string;
  number: string;
  vehicleNo?: string;
  invoiceNo?: string;
  deliveredAt?: string;
  supplier?: { name: string };
  requisition?: { number: string };
  lines: QueueLine[];
};
type Log = {
  id: string;
  vehicleNo?: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  measuredAt: string;
  delivery?: {
    number: string;
    partialLineCount: number;
    requisition?: { id: string; number: string } | null;
    supplier?: { name: string } | null;
  } | null;
};

export function WeighbridgePage() {
  const [pageLoading, runPageLoad] = usePageLoading(),
    [, setMessage] = useToastMessage();
  const [queue, setQueue] = useState<QueueItem[]>([]),
    [logs, setLogs] = useState<Log[]>([]),
    [selected, setSelected] = useState<QueueItem | null>(null);
  const [view, setView] = useState<"pending" | "history">("pending");
  const [search, setSearch] = useState(""),
    [requisitionFilter, setRequisitionFilter] = useState(""),
    [dateFilter, setDateFilter] = useState("");
  const [gross, setGross] = useState(""),
    [tare, setTare] = useState(""),
    [values, setValues] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState(false);
  const load = () =>
    runPageLoad(async () => {
      if (!selectedOrg()) return setMessage("Select an organisation first.");
      try {
        const [q, l] = await Promise.all([
          api<{ data: QueueItem[] }>("/weighments/queue"),
          api<{ data: Log[] }>("/weighments"),
        ]);
        setQueue(q.data);
        setLogs(l.data);
        setMessage("");
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Unable to load weighbridge.",
        );
      }
    });
  useEffect(() => {
    void load();
  }, []);
  const open = (d: QueueItem) => {
    setSelected(d);
    setGross("");
    setTare("");
    setValues(
      Object.fromEntries(d.lines.map((l) => [l.id, String(l.declaredQty)])),
    );
  };
  const net = Number(gross) - Number(tare);
  const ready =
    !!selected &&
    Number(gross) > Number(tare) &&
    selected.lines.every(
      (l) => values[l.id] !== "" && Number(values[l.id]) >= 0,
    );
  const matches = (l: QueueLine) =>
    Number(values[l.id]) === Number(l.remainingQty);
  const shortfall = (l: QueueLine) =>
    Math.max(0, Number(l.remainingQty) - Number(values[l.id] || 0));
  const historyRequisitions = Array.from(
    new Map(
      logs
        .flatMap((w) =>
          w.delivery?.requisition ? [w.delivery.requisition] : [],
        )
        .map((r) => [r.id, r]),
    ).values(),
  );
  const filteredLogs = logs.filter((w) => {
    const q = search.trim().toLowerCase(),
      day = new Date(w.measuredAt).toISOString().slice(0, 10);
    return (
      (!q ||
        [
          w.delivery?.number,
          w.delivery?.requisition?.number,
          w.delivery?.supplier?.name,
          w.vehicleNo,
        ].some((v) => v?.toLowerCase().includes(q))) &&
      (!requisitionFilter ||
        w.delivery?.requisition?.id === requisitionFilter) &&
      (!dateFilter || day === dateFilter)
    );
  });
  const submit = async () => {
    if (!selected || !ready) return;
    setSaving(true);
    try {
      await api("/weighments/reports", {
        method: "POST",
        body: JSON.stringify({
          deliveryId: selected.id,
          grossWeight: Number(gross),
          tareWeight: Number(tare),
          lines: selected.lines.map((l) => ({
            lineId: l.id,
            measuredQty: Number(values[l.id]),
          })),
        }),
      });
      setSelected(null);
      await load();
      appToast.approval(
        "Weighbridge report submitted and awaiting manager approval.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to submit report.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <PageContainer 
      loading={pageLoading}
      cap="Weighbridge Station"
      title="Weighbridge Station" 
      description="Measure each challan before manager approval. Submitted reports are locked and sent to the assigned manager."
      headerContent={
        <div className="grid grid-cols-3 gap-4 max-[800px]:grid-cols-1">
                <Card>
                  <div className="text-2xl font-bold">{queue.length}</div>
                  <div className="text-sm text-[#71877b]">Awaiting weighbridge</div>
                </Card>
                <Card>
                  <div className="text-2xl font-bold">{logs.length}</div>
                  <div className="text-sm text-[#71877b]">Reports submitted</div>
                </Card>
                <Card>
                  <div className="text-2xl font-bold">
                    {logs[0] ? Number(logs[0].netWeight).toLocaleString() : "-"}
                  </div>
                  <div className="text-sm text-[#71877b]">Latest net weight (kg)</div>
                </Card>
              </div>
      }
    >
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e5dd] p-4">
          <div className="flex items-center gap-2">
            <Button
              variant={view === "pending" ? "primary" : "secondary"}
              onClick={() => setView("pending")}
            >
              <Scale size={15} /> Pending Measurements{" "}
              <span className="opacity-70">({queue.length})</span>
            </Button>
            <Button
              variant={view === "history" ? "primary" : "secondary"}
              onClick={() => setView("history")}
            >
              <ClipboardCheck size={15} /> Weighbridge History{" "}
              <span className="opacity-70">({logs.length})</span>
            </Button>
          </div>
          {view === "history" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71877b]"
                  size={15}
                />
                <Input
                  className="w-64 pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search challan, requisition..."
                />
              </div>
              <Dropdown
                className="w-56"
                value={requisitionFilter}
                onChange={(e) => setRequisitionFilter(e.target.value)}
              >
                <option value="">All requisitions</option>
                {historyRequisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number}
                  </option>
                ))}
              </Dropdown>
              <Input
                className="w-40"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          )}
        </div>
        {view === "pending" ? (
          <>
            <div className="flex items-center justify-between px-5 py-3">
            
            </div>
            <DataTable
              columns={[
                "Challan",
                "Requisition",
                "Supplier",
                "Vehicle",
                "Products",
                "Received",
                "Action",
              ]}
              empty={
                queue.length === 0 && (
                  <div className="flex flex-col items-center p-10">
                    <ClipboardCheck size={30} />
                    <b className="mt-3">No challans awaiting measurement</b>
                  </div>
                )
              }
            >
              {queue.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.number}</strong>
                  </td>
                  <td>{d.requisition?.number ?? "-"}</td>
                  <td>{d.supplier?.name ?? "-"}</td>
                  <td>{d.vehicleNo ?? "-"}</td>
                  <td>{d.lines.length}</td>
                  <td>
                    {d.deliveredAt
                      ? new Date(d.deliveredAt).toLocaleDateString("en-GB")
                      : "-"}
                  </td>
                  <td>
                    <Button size="sm" variant="primary" onClick={() => open(d)}>
                      <Scale size={14} /> Weigh & Verify
                    </Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </>
        ) : (
          <DataTable
            columns={[
              "Challan",
              "Requisition",
              "Supplier",
              "Vehicle",
              "Net (kg)",
              "Result",
              "Measured At",
            ]}
            empty={
              filteredLogs.length === 0 && (
                <div className="p-10 text-center">
                  No weighbridge reports match these filters.
                </div>
              )
            }
          >
            {filteredLogs.map((w) => (
              <tr key={w.id}>
                <td>
                  <strong>{w.delivery?.number ?? "-"}</strong>
                </td>
                <td>{w.delivery?.requisition?.number ?? "-"}</td>
                <td>{w.delivery?.supplier?.name ?? "-"}</td>
                <td>{w.vehicleNo ?? "-"}</td>
                <td>
                  <strong>{Number(w.netWeight).toLocaleString()}</strong>
                </td>
                <td>
                  {w.delivery?.partialLineCount ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      <CircleDashed size={14} /> Partial (
                      {w.delivery.partialLineCount})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle2 size={14} /> Complete
                    </span>
                  )}
                </td>
                <td>{new Date(w.measuredAt).toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      {selected && (
        <Modal
          title={"Weighbridge Report: " + selected.number}
          description={[
            selected.requisition?.number &&
              "Requisition " + selected.requisition.number,
            selected.supplier?.name,
            selected.vehicleNo,
          ]
            .filter(Boolean)
            .join(" | ")}
          onClose={() => setSelected(null)}
          extraWide
          fixedHeight
          footer={
            <>
              <Button onClick={() => setSelected(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!ready || saving}
                onClick={() => void submit()}
              >
                <CheckCircle2 size={15} />
                {saving ? "Submitting..." : "Submit for Approval"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-3 gap-3 max-[800px]:grid-cols-1">
            <FormField label="Gross Weight (kg)" required>
              <Input
                type="number"
                min="0"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                placeholder="Gross"
              />
            </FormField>
            <FormField label="Tare Weight (kg)" required>
              <Input
                type="number"
                min="0"
                value={tare}
                onChange={(e) => setTare(e.target.value)}
                placeholder="Tare"
              />
            </FormField>
            <FormField label="Net Weight (kg)">
              <Input
                readOnly
                value={net > 0 ? String(net) : ""}
                placeholder="Calculated"
              />
            </FormField>
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#dfe7df]">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-[#f3f5f6] text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">UOM</th>
                  <th className="p-3 text-right">Requisition Qty</th>
                  <th className="p-3 text-right">Previously Verified</th>
                  <th className="p-3 text-right">Remaining</th>
                  <th className="p-3 text-right">Challan Qty</th>
                  <th className="p-3 text-left">Actual Weight</th>
                  <th className="p-3 text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((l) => (
                  <tr key={l.id} className="border-t border-[#e4e9e3]">
                    <td className="p-3">
                      <strong>{l.product?.name ?? "-"}</strong>
                      <div className="text-xs text-[#71877b]">
                        {l.product?.sku}
                      </div>
                    </td>
                    <td className="p-3">{l.uom?.code ?? "-"}</td>
                    <td className="p-3 text-right">
                      {Number(l.requisitionQty).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      {Number(l.previouslyVerifiedQty).toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {Number(l.remainingQty).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      {Number(l.declaredQty).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <Input
                        className="h-10 w-32"
                        type="number"
                        min="0"
                        max={l.remainingQty}
                        step="0.001"
                        value={values[l.id] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [l.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="p-3 text-center">
                      {values[l.id] === "" ? (
                        "-"
                      ) : matches(l) ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle2 size={16} /> Match
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle size={16} />{" "}
                          {shortfall(l) > 0
                            ? `Partial (${shortfall(l).toLocaleString()} remaining)`
                            : "Mismatch"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[#71877b]">
            Enter the measured quantity for every product, including zero for
            missing goods. A line matches only when its actual weight fulfills
            the requisition remaining quantity. Partial quantities are accepted
            but keep the requisition incomplete.
          </p>
        </Modal>
      )}
    </PageContainer>
  );
}
