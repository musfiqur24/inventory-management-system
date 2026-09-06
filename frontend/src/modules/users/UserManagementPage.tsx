import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../../shared/api/http";
import { useAuth } from "../auth/AuthContext";
import { PageContainer } from "../../components/ui/PageContainer";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Checkbox } from "../../components/ui/Checkbox";
import { DataTable } from "../../components/ui/DataTable";
import { Badge } from "../../components/ui/Badge";
type Role = { id: string; code: string; name: string };
type Org = { id: string; name: string };
type Row = {
  membershipId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  organization: Org;
  role: Role;
};
export function UserManagementPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]),
    [roles, setRoles] = useState<Role[]>([]),
    [orgs, setOrgs] = useState<Org[]>([]),
    [form, setForm] = useState({
      fullName: "",
      email: "",
      password: "",
      roleId: "",
      organizationIds: [] as string[],
    }),
    [error, setError] = useState(""),
    [organizationFilter, setOrganizationFilter] = useState(""),
    [page, setPage] = useState(1);
  const load = async () => {
    try {
      const [u, r, o] = await Promise.all([
        api<{ data: Row[] }>("/users"),
        api<{ data: Role[] }>("/users/roles"),
        api<{ data: Org[] }>("/my-organizations"),
      ]);
      setRows(u.data);
      setRoles(r.data);
      setOrgs(o.data);
      setForm((x) => ({
        ...x,
        roleId: x.roleId || r.data.find((v) => v.code === "STAFF")?.id || "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/users", { method: "POST", body: JSON.stringify(form) });
      setForm({
        fullName: "",
        email: "",
        password: "",
        roleId: roles.find((v) => v.code === "STAFF")?.id || "",
        organizationIds: [],
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user");
    }
  };
  return (
    <PageContainer
      cap="ACCESS CONTROL"
      title="User Management"
      description="Create users and assign each user to one or more organizations."
      notice={
        error ? (
          <div className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>
        ) : undefined
      }
    >
      <Card>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            type="password"
            placeholder="Temporary password (min 8)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select
            value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
          >
            {roles
              .filter(
                (r) =>
                  user?.isSuperAdmin ||
                  !["SUPER_ADMIN", "ADMIN"].includes(r.code),
              )
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            {orgs.map((o) => (
              <Checkbox
                key={o.id}
                label={o.name}
                checked={form.organizationIds.includes(o.id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    organizationIds: e.target.checked
                      ? [...form.organizationIds, o.id]
                      : form.organizationIds.filter((id) => id !== o.id),
                  })
                }
              />
            ))}
          </div>
          <div>
            <Button variant="primary">Create user</Button>
          </div>
        </form>
      </Card>
      <div className="flex justify-end">
        <Select
          value={organizationFilter}
          onChange={(e) => {
            setOrganizationFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-70"
        >
          <option value="">All organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>
      <Card padding="none">
        {(() => {
          const filtered = organizationFilter
            ? rows.filter((r) => r.organization.id === organizationFilter)
            : rows;
          const shown = filtered.slice((page - 1) * 10, page * 10);
          return (
            <DataTable
              columns={["User", "Organization", "Role", "Status", "Action"]}
              total={filtered.length}
              page={page}
              pageSize={10}
              onPageChange={setPage}
            >
              {shown.map((r) => (
                <tr key={r.membershipId} className="border-b border-[#e0e5dd]">
                  <td className="px-5 py-4">
                    <b>{r.fullName}</b>
                    <br />
                    <small className="text-[#7a9185]">{r.email}</small>
                  </td>
                  <td className="px-5 py-4">{r.organization.name}</td>
                  <td className="px-5 py-4">
                    <Badge variant="brand">{r.role.name}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={r.isActive ? "green" : "gray"}>
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        aria-label="Edit user"
                        className="grid size-8 place-items-center rounded-md text-[#2563eb] hover:bg-blue-50"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        aria-label="Delete user"
                        className="grid size-8 place-items-center rounded-md text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          );
        })()}
      </Card>
    </PageContainer>
  );
}
