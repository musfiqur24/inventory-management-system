import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, selectedOrg } from "../../../shared/api/http";
import { useToastMessage } from "../../../components/ui/Toast";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Modal } from "../../../components/ui/Modal";
import { ConfirmationModal } from "../../../components/ui/ConfirmationModal";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { Dropdown } from "../../../components/ui/Dropdown";

interface Category {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId?: string | null;
}
interface Product {
  id: string;
  sku: string;
  name: string;
  type: string;
  categoryId: string;
  baseUomId: string;
  reorderLevel?: string | number | null;
  amount?: string | number | null;
  currencyId?: string | null;
  baseUom?: { code: string } | null;
  currency?: { code: string; symbol: string } | null;
}
interface UOM {
  id: string;
  code: string;
  name: string;
}
interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}
type Row = {
  id: string;
  name: string;
  code: string;
  parents: Record<number, string>;
  groupId: string;
  uom: string;
  amount: string;
  currency: string;
  source: Category | Product;
};
const layerNames = [
  "Group Layer",
  "Control Layer",
  "Sub Layer",
  "Sub- Sub Layer",
  "Product",
];
const emptyForm = {
  name: "",
  code: "",
  type: "RAW_MATERIAL",
  baseUomId: "",
  reorderLevel: "",
  amount: "",
  currencyId: "",
};

export function ProductHierarchyPage() {
  const [pageLoading, runPageLoad] = usePageLoading(),
    [categories, setCategories] = useState<Category[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [uoms, setUoms] = useState<UOM[]>([]),
    [currencies, setCurrencies] = useState<Currency[]>([]);
  const [activeLayer, setActiveLayer] = useState(5),
    [search, setSearch] = useState(""),
    [groupFilter, setGroupFilter] = useState("ALL"),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Row | null>(null),
    [deleting, setDeleting] = useState(false);
  const [, setMessage] = useToastMessage(),
    [targetLevel, setTargetLevel] = useState(5),
    [parentL1, setParentL1] = useState(""),
    [parentL2, setParentL2] = useState(""),
    [parentL3, setParentL3] = useState(""),
    [parentL4, setParentL4] = useState("");
  const [form, setForm] = useState(emptyForm);
  const loadData = async () =>
    runPageLoad(async () => {
      if (!selectedOrg())
        return setMessage("Please select an organisation first.");
      setLoading(true);
      try {
        const [c, p, u, cu] = await Promise.all([
          api<{ data: Category[] }>("/categories"),
          api<{ data: Product[] }>("/products"),
          api<{ data: UOM[] }>("/uoms"),
          api<{ data: Currency[] }>("/currencies"),
        ]);
        setCategories(c.data);
        setProducts(p.data);
        setUoms(u.data);
        setCurrencies(cu.data);
      } catch (e: any) {
        setMessage(e.message);
      } finally {
        setLoading(false);
      }
    });
  useEffect(() => {
    void loadData();
  }, []);
  const map = new Map(categories.map((c) => [c.id, c]));
  const ancestry = (id?: string | null) => {
    const ids: Record<number, string> = {},
      codes: Record<number, string> = {};
    while (id) {
      const c = map.get(id);
      if (!c) break;
      ids[c.level] = c.id;
      codes[c.level] = c.code;
      id = c.parentId;
    }
    return { ids, codes };
  };
  const l1 = categories.filter((c) => c.level === 1),
    l2 = categories.filter((c) => c.level === 2 && c.parentId === parentL1),
    l3 = categories.filter((c) => c.level === 3 && c.parentId === parentL2),
    l4 = categories.filter((c) => c.level === 4 && c.parentId === parentL3);
  const rows: Row[] = (
    activeLayer === 5
      ? products.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.sku,
          parents: ancestry(p.categoryId).codes,
          groupId: ancestry(p.categoryId).ids[1] ?? "",
          uom: p.baseUom?.code ?? "-",
          amount: p.amount == null ? "-" : Number(p.amount).toLocaleString(),
          currency: p.currency?.code ?? "-",
          source: p,
        }))
      : categories
          .filter((c) => c.level === activeLayer)
          .map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            parents: ancestry(c.parentId).codes,
            groupId: c.level === 1 ? c.id : (ancestry(c.parentId).ids[1] ?? ""),
            uom: "",
            amount: "",
            currency: "",
            source: c,
          }))
  )
    .filter(
      (r) =>
        (activeLayer !== 5 ||
          groupFilter === "ALL" ||
          r.groupId === groupFilter) &&
        [r.name, r.code, ...Object.values(r.parents)].some((v) =>
          v.toLowerCase().includes(search.toLowerCase()),
        ),
    )
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const resetParents = () => {
    setParentL1("");
    setParentL2("");
    setParentL3("");
    setParentL4("");
  };
  const create = () => {
    setTargetLevel(activeLayer);
    setEditingId(null);
    setForm(emptyForm);
    resetParents();
    setOpen(true);
  };
  const edit = (row: Row) => {
    setTargetLevel(activeLayer);
    setEditingId(row.id);
    const source = row.source;
    const ids =
      activeLayer === 5
        ? ancestry((source as Product).categoryId).ids
        : ancestry((source as Category).parentId).ids;
    setParentL1(ids[1] ?? "");
    setParentL2(ids[2] ?? "");
    setParentL3(ids[3] ?? "");
    setParentL4(
      activeLayer === 5
        ? (ids[4] ?? "")
        : ((source as Category).parentId ?? ""),
    );
    setForm({
      name: row.name,
      code: row.code,
      type: (source as Product).type ?? "RAW_MATERIAL",
      baseUomId: (source as Product).baseUomId ?? "",
      reorderLevel: String((source as Product).reorderLevel ?? ""),
      amount: String((source as Product).amount ?? ""),
      currencyId: (source as Product).currencyId ?? "",
    });
    setOpen(true);
  };
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const parentId = [null, parentL1, parentL2, parentL3, parentL4][
        targetLevel - 1
      ];
      if (targetLevel > 1 && !parentId)
        throw new Error("Please select the required parent layers.");
      if (targetLevel === 5 && !form.baseUomId)
        throw new Error("Please select a base UOM.");
      const path = targetLevel === 5 ? "/products" : "/categories";
      await api(editingId ? path + "/" + editingId : path, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(
          targetLevel === 5
            ? {
                name: form.name.trim(),
                sku: form.code.trim(),
                type: form.type,
                categoryId: parentId,
                baseUomId: form.baseUomId,
                reorderLevel: form.reorderLevel
                  ? Number(form.reorderLevel)
                  : undefined,
                amount: form.amount ? Number(form.amount) : undefined,
                currencyId: form.currencyId || null,
              }
            : {
                name: form.name.trim(),
                code: form.code.trim(),
                level: targetLevel,
                parentId,
              },
        ),
      });
      setOpen(false);
      setEditingId(null);
      setPage(1);
      await loadData();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api(
        activeLayer === 5
          ? "/products/" + deleteTarget.id
          : "/categories/" + deleteTarget.id + "?level=" + activeLayer,
        { method: "DELETE" },
      );
      setDeleteTarget(null);
      setPage(1);
      await loadData();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setDeleting(false);
    }
  };
  const layerName = layerNames[activeLayer - 1],
    currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  const columns = [
    ...layerNames
      .slice(0, activeLayer - 1)
      .map((n) => n.replace(" Layer", "") + " Code"),
    layerName.replace(" Layer", "") + " Code",
    layerName + " Name",
    ...(activeLayer === 5 ? ["Base UOM", "Amount", "Currency"] : []),
    "Actions",
  ];
  const option = (c: Category) => (
    <option key={c.id} value={c.id}>
      {c.name} ({c.code})
    </option>
  );
  return (
    <PageContainer
      loading={pageLoading}
      cap="MASTER SETUP"
      title="Product "
      description="Manage your product layers and their parent relationships."
    >
      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-[#e0e5dd] p-6 sm:flex-row sm:items-center sm:gap-4">
          <label
            htmlFor="product-layer"
            className="shrink-0 text-sm font-semibold text-[#31483d]"
          >
            Select Product Layer:
          </label>
          <Dropdown
            id="product-layer"
            className="sm:max-w-72"
            value={activeLayer}
            onChange={(e) => {
              setActiveLayer(Number(e.target.value));
              setSearch("");
              setGroupFilter("ALL");
              setPage(1);
            }}
          >
            {layerNames.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </Dropdown>
        </div>
        <div className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold">{layerName} List</h2>
            <div className="flex flex-wrap items-center gap-2">
              {activeLayer === 5 && (
                <Dropdown
                  aria-label="Filter products by group"
                  className="w-40"
                  value={groupFilter}
                  onChange={(e) => {
                    setGroupFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Groups</option>
                  {l1.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </Dropdown>
              )}
              <Button variant="primary" onClick={create}>
                <Plus size={16} />
                New
              </Button>
              <Input
                aria-label="Search hierarchy"
                className="w-full sm:w-64"
                placeholder="Search code or name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <Button
                className="size-11 p-0"
                aria-label="Refresh hierarchy"
                disabled={loading}
                onClick={() => void loadData()}
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
              </Button>
            </div>
          </div>
          <DataTable
            columns={columns}
            scrollAreaClassName="[scrollbar-gutter:auto]"
            tableClassName="!w-full min-w-0 table-fixed [&_th]:px-2 [&_th]:py-4 [&_th]:text-[10px] [&_th:last-child]:text-center [&_td]:px-2 [&_td]:text-xs [&_td:last-child]:px-1"
            total={rows.length}
            page={currentPage}
            pageSize={10}
            onPageChange={setPage}
          >
            {rows.slice((currentPage - 1) * 10, currentPage * 10).map((row) => (
              <tr key={row.id}>
                {layerNames.slice(0, activeLayer - 1).map((n, i) => (
                  <td
                    key={n}
                    className="break-words font-mono text-[11px] leading-4"
                  >
                    {row.parents[i + 1] ?? "-"}
                  </td>
                ))}
                <td className="break-words font-mono text-[11px] leading-4">
                  {row.code}
                </td>
                <td className="break-words text-xs font-medium leading-4">
                  {row.name}
                </td>
                {activeLayer === 5 && (
                  <>
                    <td>{row.uom}</td>
                    <td>{row.amount}</td>
                    <td>{row.currency}</td>
                  </>
                )}
                <td>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="secondary"
                      className="size-9 min-h-9 shrink-0 p-0"
                      aria-label={"Edit " + row.name}
                      onClick={() => edit(row)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="secondary"
                      className="size-9 min-h-9 shrink-0 p-0 text-red-600 hover:border-red-200 hover:bg-red-50"
                      aria-label={"Delete " + row.name}
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-10 text-center text-[#73877c]"
                >
                  {loading
                    ? "Loading hierarchy..."
                    : search
                      ? "No matching records."
                      : "No records in this layer yet. Click New to add one."}
                </td>
              </tr>
            )}
          </DataTable>
        </div>
      </Card>
      {deleteTarget && (
        <ConfirmationModal
          title={"Delete " + layerName + "?"}
          confirmLabel={"Delete " + layerName}
          pendingLabel="Deleting..."
          pending={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void remove()}
        >
          Delete{" "}
          <strong>
            {deleteTarget.name} ({deleteTarget.code})
          </strong>
          ? Layers containing child records cannot be deleted.
        </ConfirmationModal>
      )}
      {open && (
        <Modal
          title={(editingId ? "Edit " : "New ") + layerNames[targetLevel - 1]}
          description="Choose the parent layers and enter the code and name."
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => void submit()}
                disabled={saving || !form.name.trim() || !form.code.trim()}
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Save"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 [&>div]:mb-0 max-[640px]:grid-cols-1">
            <FormField label="Product Layer">
              <Input
                value={layerNames[targetLevel - 1]}
                readOnly
                className="bg-[#f3f5f2]"
              />
            </FormField>
            <FormField label="Name" required>
              <Input
                placeholder="Enter title..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Code" required>
              <Input
                placeholder="Enter unique code"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
              />
            </FormField>
            {targetLevel >= 2 && (
              <FormField label="Group Layer" required>
                <Dropdown
                  value={parentL1}
                  onChange={(e) => {
                    setParentL1(e.target.value);
                    setParentL2("");
                    setParentL3("");
                    setParentL4("");
                  }}
                >
                  {l1.map(option)}
                </Dropdown>
              </FormField>
            )}
            {targetLevel >= 3 && (
              <FormField label="Control Layer" required>
                <Dropdown
                  value={parentL2}
                  disabled={!parentL1}
                  onChange={(e) => {
                    setParentL2(e.target.value);
                    setParentL3("");
                    setParentL4("");
                  }}
                >
                  {l2.map(option)}
                </Dropdown>
              </FormField>
            )}
            {targetLevel >= 4 && (
              <FormField label="Sub Layer" required>
                <Dropdown
                  value={parentL3}
                  disabled={!parentL2}
                  onChange={(e) => {
                    setParentL3(e.target.value);
                    setParentL4("");
                  }}
                >
                  {l3.map(option)}
                </Dropdown>
              </FormField>
            )}
            {targetLevel === 5 && (
              <FormField label="Sub- Sub Layer" required>
                <Dropdown
                  value={parentL4}
                  disabled={!parentL3}
                  onChange={(e) => setParentL4(e.target.value)}
                >
                  {l4.map(option)}
                </Dropdown>
              </FormField>
            )}
            {targetLevel === 5 && (
              <>
                <FormField label="Product Material Type" required>
                  <Dropdown
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="FINISHED_GOOD">
                      Finished Good (Feed Product)
                    </option>
                    <option value="RAW_MATERIAL">
                      Raw Material (Ingredient)
                    </option>
                    <option value="PACKAGING">Packaging Material</option>
                    <option value="BY_PRODUCT">By-Product</option>
                  </Dropdown>
                </FormField>
                <FormField label="Base Unit of Measure (UOM)" required>
                  <Dropdown
                    value={form.baseUomId}
                    onChange={(e) =>
                      setForm({ ...form, baseUomId: e.target.value })
                    }
                  >
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </Dropdown>
                </FormField>
                <FormField label="Amount">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Currency">
                  <Dropdown
                    value={form.currencyId}
                    onChange={(e) =>
                      setForm({ ...form, currencyId: e.target.value })
                    }
                  >
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name} ({c.symbol})
                      </option>
                    ))}
                  </Dropdown>
                </FormField>
                <FormField label="Reorder Level Threshold">
                  <Input
                    type="number"
                    min="0"
                    value={form.reorderLevel}
                    onChange={(e) =>
                      setForm({ ...form, reorderLevel: e.target.value })
                    }
                  />
                </FormField>
              </>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
