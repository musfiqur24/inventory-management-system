import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { api, selectedOrg } from "../shared/api/http";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import { FormField } from "../components/ui/FormField";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";

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
    <section className="page">
      <PageHeader
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
      />
      {open && (
        <form className="card ui-form" onSubmit={submit}>
          <h2>New {title.replace(/s$/, "")}</h2>
          <div className="ui-form-grid">
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
          <div className="ui-form-actions">
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save record
            </Button>
          </div>
        </form>
      )}
      <section className="card resource-table">
        <div className="table-title">
          <h2>Live records</h2>
          <Button onClick={() => void load()}>
            <RefreshCw />
            Refresh
          </Button>
        </div>
        {message && <p className="notice">{message}</p>}
        <DataTable
          columns={columns.map((column) =>
            column.replaceAll(/([A-Z])/g, " $1"),
          )}
          empty={
            !message && rows.length === 0 ? (
              <div className="empty-state">
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
      </section>
    </section>
  );
}
