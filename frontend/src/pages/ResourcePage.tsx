import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { api, selectedOrg } from "../shared/api/http";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import { FormField } from "../components/ui/FormField";
import { Input } from "../components/ui/Input";
import { PageContainer } from "../components/ui/PageContainer";
import { Card, CardHeader } from "../components/ui/Card";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date";
  placeholder?: string;
};
export type ResourcePageProps = {
  title: string;
  subtitle: string;
  resource: string;
  fields: Field[];
  report?: boolean;
  readOnly?: boolean;
};
export function ResourcePage({
  title,
  subtitle,
  resource,
  fields,
  report = false,
  readOnly = false,
}: ResourcePageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!selectedOrg())
      return setMessage("Select or create an organisation first.");
    try {
      const result = await api<{ data: Record<string, unknown>[] }>(
        `/${resource}`,
      );
      setRows(result.data);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load records",
      );
    }
  };
  useEffect(() => {
    void load();
  }, [resource]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          value === ""
            ? undefined
            : Number.isNaN(Number(value))
              ? value
              : Number(value),
        ]),
      );
      await api(`/${resource}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setForm({});
      setOpen(false);
      void load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save record",
      );
    }
  };
  const columns = rows.length
    ? Object.keys(rows[0])
        .filter((key) => !["organizationId", "id"].includes(key))
        .slice(0, 7)
    : fields.map((field) => field.name);
  return (
    <PageContainer
      title={title}
      description={subtitle}
      actions={
        <>
          {report && (
            <Button onClick={() => window.print()}>Download report</Button>
          )}
          {!readOnly && (
            <Button variant="primary" onClick={() => setOpen(!open)}>
              <Plus />
              Create {title.replace(/s$/, "")}
            </Button>
          )}
        </>
      }
   >
      {open && (
        <form onSubmit={submit}>
          <Card className="mb-4">
            <h2>New {title.replace(/s$/, "")}</h2>
            <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
              {fields.map((field) => (
                <FormField key={field.name} label={field.label}>
                  <Input
                    required
                    type={field.type ?? "text"}
                    value={form[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setForm({ ...form, [field.name]: event.target.value })
                    }
                  />
                </FormField>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Button type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save record
              </Button>
            </div>
          </Card>
        </form>
      )}
      <Card>
        <CardHeader
          title="Live records"
          actions={
            <Button onClick={() => void load()}>
              <RefreshCw />
              Refresh
            </Button>
          }
        />
        {message && <p className="p-[12px_16px] rounded-[8px] text-[13.5px] m-[10px_0] flex items-start gap-2.5 [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:shrink-0 [:where(&_svg)]:mt-0.25">{message}</p>}
        <DataTable
          columns={columns.map((column) =>
            column.replaceAll(/([A-Z])/g, " $1"),
          )}
          empty={
            !message && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70">
                <b>No {title.toLowerCase()} yet</b>
                <span>
                  {readOnly
                    ? "Records appear after the related workflow posts stock movements."
                    : "Use Create to add the first record for this organisation."}
                </span>
              </div>
            ) : undefined
          }
       >
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map((key) => (
                <td key={key}>
                  {row[key] == null
                    ? "—"
                    : typeof row[key] === "object"
                      ? JSON.stringify(row[key])
                      : String(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </DataTable>
      </Card>
    </PageContainer>
  );
}
