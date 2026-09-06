import { useEffect, useState } from "react";
import { api } from "../../shared/api/http";
import { useAuth } from "../auth/AuthContext";
import { PageContainer } from "../../components/ui/PageContainer";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
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
    [error, setError] = useState("");
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
              <label key={o.id} className="rounded-lg border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.organizationIds.includes(o.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      organizationIds: e.target.checked
                        ? [...form.organizationIds, o.id]
                        : form.organizationIds.filter((id) => id !== o.id),
                    })
                  }
                />{" "}
                {o.name}
              </label>
            ))}
          </div>
          <div>
            <Button variant="primary">Create user</Button>
          </div>
        </form>
      </Card>
      <Card padding="none">
        <table className="w-full">
          <thead className="bg-[#f8faf7] text-left text-xs">
            <tr>
              <th className="p-3">User</th>
              <th>Organization</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.membershipId} className="border-t">
                <td className="p-3">
                  <b>{r.fullName}</b>
                  <br />
                  <small>{r.email}</small>
                </td>
                <td>{r.organization.name}</td>
                <td>{r.role.name}</td>
                <td>{r.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
