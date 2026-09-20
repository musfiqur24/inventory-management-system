import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  ArrowDownToLine,
  ArrowUpFromLine,
  Warehouse,
  Trash2,
} from "lucide-react";
import { api } from "../../../shared/api/http";
import { useAuth } from "../../auth/AuthContext";
import { appToast } from "../../../components/ui/Toast";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dropdown } from "../../../components/ui/Dropdown";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { FormField } from "../../../components/ui/FormField";
import { ConfirmationModal } from "../../../components/ui/ConfirmationModal";
import { ReceiveStockModal, ReleaseStockModal } from "./StockModals";
import {
  storeTypeLabel,
  type Store,
  type StoreType,
  type Bin,
  type StockBalance,
  type Activity,
  type ReceiptDocument,
} from "./store.types";

type RequisitionOption={id:string;number:string;status:string};

export function StoresPage({ fixedType }: { fixedType?: StoreType }) {
  const isSetup = !fixedType;
  const { can } = useAuth();
  const writable = can("departments.write");
  const [stores, setStores] = useState<Store[]>([]),
    [storeId, setStoreId] = useState("");
  const [bins, setBins] = useState<Bin[]>([]),
    [balances, setBalances] = useState<StockBalance[]>([]),
    [activity, setActivity] = useState<Activity[]>([]),
    [requisitions,setRequisitions]=useState<RequisitionOption[]>([]),
    [pendingReceipts,setPendingReceipts]=useState(0);
  const [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [selectedTab, setTab] = useState<"bins" | "stock" | "activity">(
    fixedType ? "stock" : "bins",
  );
  const tab = isSetup ? "bins" : selectedTab === "bins" ? "stock" : selectedTab;
  const [binId, setBinId] = useState(""),
    [search, setSearch] = useState(""),
    [direction, setDirection] = useState(""),
    [requisitionFilter,setRequisitionFilter]=useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [loading, setLoading] = useState(false),
    [storeLoading, setStoreLoading] = useState(true);
  const [storeForm, setStoreForm] = useState<{
    id?: string;
    code: string;
    name: string;
    storeType: StoreType;
    address: string;
  } | null>(null);
  const [binForm, setBinForm] = useState<{
    id?: string;
    code: string;
    name: string;
    zone: string;
    capacity: string;
  } | null>(null);
  const [saving, setSaving] = useState(false),
    [deleteTarget, setDeleteTarget] = useState<{ type: "store"; item: Store } | { type: "bin"; item: Bin } | null>(null),
    [deleting, setDeleting] = useState(false),
    [receive, setReceive] = useState(false),
    [release, setRelease] = useState<StockBalance | null>(null);
  const store = stores.find((s) => s.id === storeId);
  const refresh = () => setRevision((v) => v + 1);
  useEffect(() => {
    let active = true;
    void api<{ data: Store[] }>(
      `/stores${fixedType ? "?type=" + fixedType : ""}`,
    )
      .then((r) => {
        if (active) {
          setStores(r.data);
          setStoreId((id) =>
            r.data.some((s) => s.id === id) ? id : (r.data[0]?.id ?? ""),
          );
        }
      })
      .catch((e) => appToast.error(e.message))
      .finally(() => {
        if (active) setStoreLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fixedType, revision]);
  useEffect(()=>{if(fixedType!=="RM_STORE")return;void api<{data:RequisitionOption[]}>("/purchase-requisitions").then(r=>setRequisitions(r.data.filter(x=>!["CANCELLED","REJECTED"].includes(x.status)))).catch(e=>appToast.error(e.message))},[fixedType,revision]);
  useEffect(() => {
    if (!storeId) {
      setBins([]);
      setBalances([]);
      setActivity([]);
      setTotal(0);
      setPendingReceipts(0);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        if (isSetup) {
          const result = await api<{ data: Bin[] }>(`/bins?storeId=${storeId}`);
          if (active) { setBins(result.data); setBalances([]); setActivity([]); setTotal(0); }
          return;
        }
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "20",
        });
        if (binId) params.set("binId", binId);
        if (direction) params.set("direction", direction);
        if (requisitionFilter) params.set("search", requisitionFilter);
        if (from)
          params.set("from", new Date(from + "T00:00:00").toISOString());
        if (to) params.set("to", new Date(to + "T23:59:59.999").toISOString());
        const [b, stock, history, pending] = await Promise.all([
          api<{ data: Bin[] }>(`/bins?storeId=${storeId}`),
          api<{ data: StockBalance[] }>(
            `/stores/${storeId}/balances?${new URLSearchParams({
              ...(binId ? { binId } : {}),
              ...(fixedType === "RM_STORE" && requisitionFilter
                ? { requisition: requisitionFilter }
                : {}),
            })}`,
          ),
          api<{ data: Activity[]; total: number }>(
            `/stores/${storeId}/activity?${params}`,
          ),
          fixedType === "RM_STORE"
            ? api<{ data: ReceiptDocument[] }>(`/stores/${storeId}/receiving-options`)
            : Promise.resolve({ data: [] as ReceiptDocument[] }),
        ]);
        if (active) {
          setBins(b.data);
          setBalances(stock.data);
          setActivity(history.data);
          setTotal(history.total);
          setPendingReceipts(pending.data.length);
        }
      } catch (e) {
        if (active)
          appToast.error(
            e instanceof Error ? e.message : "Unable to load store details.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = isSetup ? undefined : window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [storeId, binId, page, direction, requisitionFilter, from, to, revision, isSetup]);
  const chooseStore = (id: string) => {
    setStoreId(id);
    setBinId("");
    setPage(1);
    setSearch("");
    setRequisitionFilter("");
    setBalances([]);
    setActivity([]);
  };
  const saveStore = async () => {
    if (!storeForm || saving) return;
    setSaving(true);
    try {
      const r = await api<{ data: Store }>(
        storeForm.id ? `/stores/${storeForm.id}` : "/stores",
        {
          method: storeForm.id ? "PUT" : "POST",
          body: JSON.stringify(storeForm),
        },
      );
      setStoreForm(null);
      setStoreId(r.data.id);
      setBinId("");
      refresh();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Unable to save store.");
    } finally {
      setSaving(false);
    }
  };
  const saveBin = async () => {
    if (!binForm || !store || saving) return;
    setSaving(true);
    try {
      await api(binForm.id ? `/bins/${binForm.id}` : "/bins", {
        method: binForm.id ? "PUT" : "POST",
        body: JSON.stringify({
          ...binForm,
          storeId: store.id,
          capacity: binForm.capacity ? Number(binForm.capacity) : undefined,
        }),
      });
      setBinForm(null);
      refresh();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Unable to save bin.");
    } finally {
      setSaving(false);
    }
  };
  const removeTarget = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api(deleteTarget.type === "store" ? `/stores/${deleteTarget.item.id}` : `/bins/${deleteTarget.item.id}`, { method: "DELETE" });
      if (deleteTarget.type === "store") chooseStore("");
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Unable to delete the selected location.");
    } finally {
      setDeleting(false);
    }
  };
  const term = search.toLowerCase();
  const filteredBins = bins.filter((b) =>
    [b.code, b.name, b.zone ?? ""].some((v) => v.toLowerCase().includes(term)),
  );
  const stock = balances.filter((b) =>
    [b.product.name, b.product.sku, b.bin.code, b.lot.code].some((v) =>
      v.toLowerCase().includes(term),
    ),
  );
  const totals = Object.entries(
    balances.reduce<Record<string, number>>((result, b) => {
      result[b.uom.code] = (result[b.uom.code] ?? 0) + Number(b.quantity);
      return result;
    }, {}),
  );
  return (
    <PageContainer loading={storeLoading}
      cap={fixedType ? "INVENTORY" : "MASTER SETUP"}
      title={fixedType ? storeTypeLabel(fixedType) : "Stores & Bins"}
      description={isSetup ? "Configure RM and FM stores and the bin positions inside each store." : "View products in your store, receive and release stock, and trace store activity."}
      headerContent={!isSetup && store ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card tone="sand" className="flex min-h-28 flex-col items-center justify-center text-center">
            <p className="text-2xl font-bold">{bins.length}</p>
            <p className="text-sm text-[#73877c]">Bins in this store</p>
          </Card>
          <Card tone="sage" className="flex min-h-28 flex-col items-center justify-center text-center">
            <p className="text-2xl font-bold">{new Set(balances.map((b) => b.productId)).size}</p>
            <p className="text-sm text-[#73877c]">Products in stock</p>
          </Card>
          <Card tone="blue" className="flex min-h-28 flex-col items-center justify-center text-center">
            <p className="text-xl font-bold">
              {totals.length ? totals.map(([uom, qty]) => qty.toLocaleString() + " " + uom).join(" - ") : "No stock"}
            </p>
            <p className="mt-1 text-sm text-[#73877c]">On hand by unit{binId ? " - selected bin" : ""}</p>
          </Card>
        </div>
      ) : undefined}
      actions={
        !fixedType ? (
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:flex-nowrap">
            <div className="w-full min-w-64 sm:w-80">
              <label htmlFor="active-store-setup" className="sr-only">Store</label>
              <Dropdown id="active-store-setup" value={storeId} onChange={(e) => chooseStore(e.target.value)}>
                <option value="">{storeLoading ? "Loading stores..." : "Select a store"}</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name} ({storeTypeLabel(s.storeType)})</option>)}
              </Dropdown>
            </div>
            {writable && store && <Button className="size-11 shrink-0 p-0" title="Edit store" aria-label="Edit store" onClick={() => setStoreForm({ id: store.id, code: store.code, name: store.name, storeType: store.storeType, address: store.address ?? "" })}><Pencil size={16} /></Button>}
            {writable && store && <Button variant="danger" className="size-11 shrink-0 p-0" title="Delete store" aria-label="Delete store" onClick={() => setDeleteTarget({ type: "store", item: store })}><Trash2 size={16} /></Button>}
            {writable && (
              <Button
                className="shrink-0"
                variant="primary"
                onClick={() =>
                  setStoreForm({
                    code: "",
                    name: "",
                    storeType: "RM_STORE",
                    address: "",
                  })
                }
              >
                <Plus size={16} /> New Store
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {!store && !storeLoading && (
        <Card>
          <div className="py-10 text-center">
            <Warehouse className="mx-auto mb-3 text-[#73877c]" />
            <p className="font-semibold">No store selected</p>
            <p className="mt-2 text-sm text-[#73877c]">
              Create an RM or FM store in Master Setup, then add bins inside it.
            </p>
          </div>
        </Card>
      )}
      {store && (
        <>
          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e5dd] p-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
                {isSetup ? <h2 className="font-semibold">Bin Setup</h2> : (["stock", "activity"] as const).map((value) => (
                  <Button
                    key={value}
                    variant={tab === value ? "primary" : "secondary"}
                    onClick={() => setTab(value)}
                  >
                    {value === "stock" ? "Current Stock" : "Store Activity"}
                  </Button>
                ))}
              </div>
              <div className="flex flex-1 flex-wrap items-end justify-end gap-2">
                {!isSetup && (
                  <>
                    <div className="w-full min-w-64 sm:w-96">
                      <label htmlFor="active-store" className="sr-only">Store</label>
                      <Dropdown id="active-store" value={storeId} onChange={(e) => chooseStore(e.target.value)}>
                        <option value="">{storeLoading ? "Loading stores..." : "Select a store"}</option>
                        {stores.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name} ({storeTypeLabel(s.storeType)})</option>)}
                      </Dropdown>
                    </div>
                  </>
                )}
                {writable && (
                  <>
                    {isSetup && <Button
                      onClick={() =>
                        setBinForm({
                          code: "",
                          name: "",
                          zone: "",
                          capacity: "",
                        })
                      }
                    >
                      <Plus size={16} /> Add Bin
                    </Button>}
                    {!isSetup && <div className="relative">
                      {fixedType === "RM_STORE" && pendingReceipts > 0 && <span className="absolute -right-2 -top-2 z-10 grid min-w-5.5 place-items-center rounded-full bg-[#d94a3d] px-1.5 py-0.5 text-[11px] font-bold leading-4 text-white shadow-sm" aria-label={`${pendingReceipts} pending receipts`}>{pendingReceipts}</span>}
                      <Button variant="primary" disabled={!bins.length} onClick={() => setReceive(true)}>
                        <ArrowDownToLine size={16} /> Receive Stock
                      </Button>
                    </div>}
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 items-end gap-3 border-b border-[#e0e5dd] bg-[#fbfcfa] p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,15rem)_repeat(4,minmax(0,11rem))]">
              {tab !== "activity" && (
                <div className="min-w-0">
                  <label
                    htmlFor="store-search"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Search
                  </label>
                  <Input
                    id="store-search"
                    className="h-11"
                    placeholder={
                      tab === "bins"
                        ? "Search bin code, name, position..."
                        : "Search product, bin, or lot..."
                    }
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
              {tab !== "bins" && (
                <div className="min-w-0">
                  <label
                    htmlFor="store-bin-filter"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Bin
                  </label>
                  <Dropdown
                    id="store-bin-filter"
                    value={binId}
                    onChange={(e) => {
                      setBinId(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All bins</option>
                    {bins.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </Dropdown>
                </div>
              )}
              {tab === "stock" && fixedType === "RM_STORE" && (
                <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                  <label htmlFor="stock-requisition" className="mb-2 block text-sm font-semibold">
                    Requisition
                  </label>
                  <Dropdown
                    id="stock-requisition"
                    value={requisitionFilter}
                    onChange={(e) => {
                      setRequisitionFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All requisitions</option>
                    {requisitions.map((r) => (
                      <option key={r.id} value={r.number}>{r.number}</option>
                    ))}
                  </Dropdown>
                </div>
              )}
              {tab === "activity" && (
                <>
                  {fixedType === "RM_STORE" && <div className="min-w-0 sm:col-span-2 xl:col-span-2"><label htmlFor="activity-requisition" className="mb-2 block text-sm font-semibold">Requisition</label><Dropdown id="activity-requisition" value={requisitionFilter} onChange={e=>{setRequisitionFilter(e.target.value);setPage(1)}}><option value="">All requisitions</option>{requisitions.map(r=><option key={r.id} value={r.number}>{r.number}</option>)}</Dropdown></div>}
                  <div className="min-w-0">
                    <label
                      htmlFor="activity-direction"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Direction
                    </label>
                    <Dropdown
                      id="activity-direction"
                      value={direction}
                      onChange={(e) => {
                        setDirection(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">In and out</option>
                      <option value="IN">Stock in</option>
                      <option value="OUT">Stock out</option>
                    </Dropdown>
                  </div>
                  <div className="min-w-0">
                    <label
                      className="mb-2 block text-sm font-semibold"
                      htmlFor="activity-from"
                    >
                      From date
                    </label>
                    <Input
                      className="h-11 min-w-0"
                      id="activity-from"
                      type="date"
                      value={from}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <label
                      className="mb-2 block text-sm font-semibold"
                      htmlFor="activity-to"
                    >
                      To date
                    </label>
                    <Input
                      className="h-11 min-w-0"
                      id="activity-to"
                      type="date"
                      value={to}
                      min={from}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            {tab === "bins" && (
              <DataTable loading={loading && bins.length === 0 && balances.length === 0 && activity.length === 0}
                columns={[
                  "Bin Code",
                  "Bin Name",
                  "Position / Zone",
                  "Capacity (kg)",
                  "Actions",
                ]}
              >
                {filteredBins.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono">{b.code}</td>
                    <td className="font-semibold">{b.name}</td>
                    <td>{b.zone || "—"}</td>
                    <td>
                      {b.capacity
                        ? Number(b.capacity).toLocaleString()
                        : "Not set"}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {writable && (
                          <Button
                            size="sm"
                            aria-label={`Edit ${b.code}`}
                            onClick={() =>
                              setBinForm({
                                id: b.id,
                                code: b.code,
                                name: b.name,
                                zone: b.zone ?? "",
                                capacity: b.capacity ? String(b.capacity) : "",
                              })
                            }
                          >
                            <Pencil size={16} />
                          </Button>
                        )}
                        {writable && (
                          <Button size="sm" variant="danger" aria-label={`Delete ${b.code}`} title={`Delete ${b.code}`} onClick={() => setDeleteTarget({ type: "bin", item: b })}>
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredBins.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      {loading
                        ? "Loading..."
                        : "No bins found. Add a bin to define a position inside this store."}
                    </td>
                  </tr>
                )}
              </DataTable>
            )}
            {tab === "stock" && (
              <DataTable loading={loading && bins.length === 0 && balances.length === 0 && activity.length === 0}
                columns={[
                  "Product",
                  ...(fixedType === "RM_STORE" ? ["Requisition #"] : []),
                  "Bin / Position",
                  ...(fixedType === "RM_STORE" ? [] : ["Lot"]),
                  "Quality / Expiry",
                  ...(fixedType === "RM_STORE" ? [] : ["On Hand"]),
                  "Reserved",
                  "Available",
                  "Updated",
                  "Actions",
                ]}
              >
                {stock.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.product.name}</strong>
                      <div className="text-xs text-[#73877c]">
                        {b.product.sku}
                      </div>
                    </td>
                    {fixedType === "RM_STORE" && <td><span className="font-mono text-xs font-semibold text-[#0d3b2e]">{b.requisitionNumber ?? ""}</span></td>}
                    <td>
                      {b.bin.code}
                      <div className="text-xs text-[#73877c]">{b.bin.zone}</div>
                    </td>
                    {fixedType !== "RM_STORE" && <td className="text-xs">{b.lot.code}</td>}
                    <td className="text-xs">
                      {b.lot.qualityStatus}
                      <div>
                        {b.lot.expiryDate
                          ? new Date(b.lot.expiryDate).toLocaleDateString()
                          : "No expiry"}
                      </div>
                    </td>
                    {fixedType !== "RM_STORE" && <td>
                      {Number(b.quantity).toLocaleString()} {b.uom.code}
                    </td>}
                    <td>{Number(b.reservedQty).toLocaleString()}</td>
                    <td className="font-semibold">
                      {(
                        Number(b.quantity) - Number(b.reservedQty)
                      ).toLocaleString()}{" "}
                      {b.uom.code}
                    </td>
                    <td className="text-xs">
                      {new Date(b.updatedAt).toLocaleString()}
                    </td>
                    <td>
                      {writable && (
                        <Button
                          size="sm"
                          disabled={
                            Number(b.quantity) <= Number(b.reservedQty) ||
                            b.lot.qualityStatus !== "RELEASED" ||
                            !!(
                              b.lot.expiryDate &&
                              new Date(b.lot.expiryDate) < new Date()
                            )
                          }
                          className="size-9 min-h-9 p-0"
                          title={store.storeType === "RM_STORE" ? "Issue raw material" : "Dispatch finished good"}
                          aria-label={store.storeType === "RM_STORE" ? `Issue ${b.product.name}` : `Dispatch ${b.product.name}`}
                          onClick={() => setRelease(b)}
                        >
                          <ArrowUpFromLine size={15} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!stock.length && (
                  <tr>
                    <td colSpan={fixedType === "RM_STORE" ? 7 : 9} className="py-8 text-center">
                      {loading
                        ? "Loading..."
                        : "No stock in this selection. Receive a delivery or production batch to add stock."}
                    </td>
                  </tr>
                )}
              </DataTable>
            )}
            {tab === "activity" && (
              <DataTable loading={loading && bins.length === 0 && balances.length === 0 && activity.length === 0}
                columns={[
                  "Date & Time",
                  "In / Out",
                  "Product",
                  "Bin",
                  "Lot",
                  "Quantity",
                  "Balance After",
                  "Source Document",
                  "Requisition / Order",
                  "Recorded By",
                  "Notes",
                ]}
                total={total}
                page={page}
                pageSize={20}
                onPageChange={setPage}
              >
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className="text-xs whitespace-nowrap">
                      {new Date(a.occurredAt).toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={
                          a.direction === "IN"
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-amber-700"
                        }
                      >
                        {a.direction}
                      </span>
                    </td>
                    <td>
                      {a.product?.name ?? "—"}
                      <div className="text-xs text-[#73877c]">
                        {a.product?.sku}
                      </div>
                    </td>
                    <td>{a.bin?.code ?? "—"}</td>
                    <td className="text-xs">{a.lot?.code ?? "—"}</td>
                    <td>
                      {Number(a.quantity).toLocaleString()} {a.uom?.code}
                    </td>
                    <td>
                      {a.balanceAfter != null
                        ? `${Number(a.balanceAfter).toLocaleString()} ${a.uom?.code ?? ""}`
                        : "—"}
                    </td>
                    <td className="text-xs">
                      {a.documentId}
                      <div className="text-[#73877c]">
                        {a.documentType.replaceAll("_", " ")}
                      </div>
                    </td>
                    <td>{a.referenceNumber ?? "—"}</td>
                    <td>{a.performedBy?.fullName ?? "—"}</td>
                    <td className="max-w-60 text-xs">{a.note ?? "—"}</td>
                  </tr>
                ))}
                {!activity.length && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center">
                      {loading
                        ? "Loading..."
                        : "No activity for the selected filters."}
                    </td>
                  </tr>
                )}
              </DataTable>
            )}
          </Card>
        </>
      )}
      {isSetup && deleteTarget && (
        <ConfirmationModal
          title={deleteTarget.type === "store" ? "Delete store?" : "Delete bin?"}
          confirmLabel={deleteTarget.type === "store" ? "Delete Store" : "Delete Bin"}
          pendingLabel="Deleting..."
          pending={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void removeTarget()}
        >
          Delete <strong>{deleteTarget.item.name}</strong>? Locations containing stock cannot be deleted.
        </ConfirmationModal>
      )}

      {isSetup && storeForm && (
        <Modal
          title={storeForm.id ? "Edit Store" : "New Store"}
          onClose={() => {
            if (!saving) setStoreForm(null);
          }}
          footer={
            <>
              <Button disabled={saving} onClick={() => setStoreForm(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={
                  saving || !storeForm.name.trim() || !storeForm.code.trim()
                }
                onClick={saveStore}
              >
                {saving ? "Saving..." : "Save Store"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 [&>div]:mb-0">
            <FormField label="Store Code" required>
              <Input
                value={storeForm.code}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, code: e.target.value })
                }
              />
            </FormField>
            <FormField label="Store Name" required>
              <Input
                value={storeForm.name}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, name: e.target.value })
                }
              />
            </FormField>
            <FormField label="Store Type" required>
              <Dropdown
                value={storeForm.storeType}
                onChange={(e) =>
                  setStoreForm({
                    ...storeForm,
                    storeType: e.target.value as StoreType,
                  })
                }
              >
                <option value="RM_STORE">RM Store</option>
                <option value="FM_STORE">FM Store</option>
              </Dropdown>
            </FormField>
            <FormField label="Location / Address">
              <Input
                value={storeForm.address}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, address: e.target.value })
                }
              />
            </FormField>
          </div>
        </Modal>
      )}
      {isSetup && binForm && store && (
        <Modal
          title={binForm.id ? "Edit Bin" : "New Bin"}
          description={`Store: ${store.name} (${storeTypeLabel(store.storeType)})`}
          onClose={() => {
            if (!saving) setBinForm(null);
          }}
          footer={
            <>
              <Button disabled={saving} onClick={() => setBinForm(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={
                  saving || !binForm.name.trim() || !binForm.code.trim()
                }
                onClick={saveBin}
              >
                {saving ? "Saving..." : "Save Bin"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 [&>div]:mb-0">
            <FormField label="Bin Code" required>
              <Input
                value={binForm.code}
                onChange={(e) =>
                  setBinForm({ ...binForm, code: e.target.value })
                }
              />
            </FormField>
            <FormField label="Bin Name" required>
              <Input
                value={binForm.name}
                onChange={(e) =>
                  setBinForm({ ...binForm, name: e.target.value })
                }
              />
            </FormField>
            <FormField label="Position / Zone">
              <Input
                placeholder="Aisle A, Rack 2, Shelf 3"
                value={binForm.zone}
                onChange={(e) =>
                  setBinForm({ ...binForm, zone: e.target.value })
                }
              />
            </FormField>
            <FormField label="Weight Capacity (kg)">
              <Input
                type="number"
                min="0.001"
                step="0.001"
                placeholder="Optional"
                value={binForm.capacity}
                onChange={(e) =>
                  setBinForm({ ...binForm, capacity: e.target.value })
                }
              />
            </FormField>
          </div>
        </Modal>
      )}
      {!isSetup && receive && store && (
        <ReceiveStockModal
          store={store}
          bins={bins}
          onClose={() => setReceive(false)}
          onSaved={refresh}
        />
      )}
      {!isSetup && release && store && (
        <ReleaseStockModal
          store={store}
          stock={release}
          onClose={() => setRelease(null)}
          onSaved={refresh}
        />
      )}
    </PageContainer>
  );
}

