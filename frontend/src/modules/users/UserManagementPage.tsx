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
import { Modal } from "../../components/ui/Modal";
import { appToast } from "../../components/ui/Toast";

type Role = { id: string; code: string; name: string };
type Org = { id: string; name: string };
type Row = {
  id: string;
  membershipId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  organization: Org;
  role: Role;
};
type EditForm = { roleId: string; organizationIds: string[] };

export function UserManagementPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", roleId: "", organizationIds: [] as string[] });
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ roleId: "", organizationIds: [] });
  const [saving, setSaving] = useState(false);

  const availableRoles = roles.filter(role => user?.isSuperAdmin || !["SUPER_ADMIN", "ADMIN"].includes(role.code));

  const load = async () => {
    try {
      const [usersResult, rolesResult, orgsResult] = await Promise.all([
        api<{ data: Row[] }>("/users"),
        api<{ data: Role[] }>("/users/roles"),
        api<{ data: Org[] }>(user?.isSuperAdmin ? "/organizations" : "/my-organizations"),
      ]);
      setRows(usersResult.data);
      setRoles(rolesResult.data);
      setOrgs(orgsResult.data);
      setForm(current => ({ ...current, roleId: current.roleId || rolesResult.data.find(role => role.code === "STAFF")?.id || "" }));
    } catch (cause) {
      appToast.error(cause instanceof Error ? cause.message : "Could not load users");
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api("/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ fullName: "", email: "", password: "", roleId: roles.find(role => role.code === "STAFF")?.id || "", organizationIds: [] });
      await load();
      appToast.success("User created successfully.");
    } catch (cause) {
      appToast.error(cause instanceof Error ? cause.message : "Could not create user");
    }
  };

  const openEdit = (row: Row) => {
    const assignedOrganizations = user?.isSuperAdmin
      ? [...new Set(rows.filter(item => item.id === row.id).map(item => item.organization.id))]
      : [row.organization.id];
    setEditing(row);
    setEditForm({ roleId: row.role.id, organizationIds: assignedOrganizations });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      if (user?.isSuperAdmin) {
        await api(`/users/${editing.id}/assignments`, { method: "PUT", body: JSON.stringify(editForm) });
      } else {
        await api(`/users/${editing.membershipId}`, { method: "PATCH", body: JSON.stringify({ roleId: editForm.roleId }) });
      }
      setEditing(null);
      await load();
      appToast.success("User access updated successfully.");
    } catch (cause) {
      appToast.error(cause instanceof Error ? cause.message : "Could not update user access");
    } finally {
      setSaving(false);
    }
  };

  const removeAccess = async (row: Row) => {
    if (!window.confirm(`Remove ${row.fullName}'s access to ${row.organization.name}?`)) return;
    try {
      await api(`/users/${row.membershipId}`, { method: "DELETE" });
      await load();
      appToast.success("Organization access removed.");
    } catch (cause) {
      appToast.error(cause instanceof Error ? cause.message : "Could not remove organization access");
    }
  };

  const filtered = organizationFilter ? rows.filter(row => row.organization.id === organizationFilter) : rows;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <PageContainer cap="ACCESS CONTROL" title="User Management" description="Create users and assign each user to one or more organizations.">
      <Card>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <Input required placeholder="Full name" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} />
          <Input required type="email" placeholder="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          <Input required minLength={8} type="password" placeholder="Temporary password (min 8)" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
          <Select required value={form.roleId} onChange={event => setForm({ ...form, roleId: event.target.value })}>
            {availableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </Select>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            {orgs.map(org => <Checkbox key={org.id} label={org.name} checked={form.organizationIds.includes(org.id)} onChange={event => setForm({ ...form, organizationIds: event.target.checked ? [...form.organizationIds, org.id] : form.organizationIds.filter(id => id !== org.id) })} />)}
          </div>
          <div><Button variant="primary">Create user</Button></div>
        </form>
      </Card>

      <div className="flex justify-end">
        <Select value={organizationFilter} onChange={event => { setOrganizationFilter(event.target.value); setPage(1); }} className="max-w-70">
          <option value="">All organizations</option>
          {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
        </Select>
      </div>

      <Card padding="none">
        <DataTable columns={["User", "Organization", "Role", "Status", "Action"]} total={filtered.length} page={currentPage} pageSize={10} onPageChange={setPage}>
          {shown.map(row => (
            <tr key={row.membershipId} className="border-b border-[#e0e5dd] last:border-0">
              <td className="px-5 py-4"><b>{row.fullName}</b><br /><small className="text-[#7a9185]">{row.email}</small></td>
              <td className="px-5 py-4">{row.organization.name}</td>
              <td className="px-5 py-4"><Badge variant="brand">{row.role.name}</Badge></td>
              <td className="px-5 py-4"><Badge variant={row.isActive ? "green" : "gray"}>{row.isActive ? "Active" : "Inactive"}</Badge></td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(row)} aria-label="Edit user access" title="Edit user access" className="grid size-8 place-items-center rounded-md text-[#2563eb] hover:bg-blue-50"><Pencil size={17} /></button>
                  <button type="button" disabled={row.id === user?.id} onClick={() => void removeAccess(row)} aria-label="Remove organization access" title={row.id === user?.id ? "You cannot remove your own access" : "Remove organization access"} className="grid size-8 place-items-center rounded-md text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={17} /></button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      {editing && (
        <Modal title="Edit user access" description={`${editing.fullName} - ${editing.email}`} onClose={() => setEditing(null)} footer={<><Button type="button" onClick={() => setEditing(null)}>Cancel</Button><Button type="button" variant="primary" disabled={saving || editForm.organizationIds.length === 0} onClick={() => void saveEdit()}>{saving ? "Saving..." : "Save changes"}</Button></>}>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#31483d]">Role</label>
            <Select value={editForm.roleId} onChange={event => setEditForm({ ...editForm, roleId: event.target.value })}>
              {availableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-[#31483d]">Assigned organizations</div>
            {user?.isSuperAdmin ? (
              <div className="flex flex-wrap gap-3">
                {orgs.map(org => <Checkbox key={org.id} label={org.name} checked={editForm.organizationIds.includes(org.id)} onChange={event => setEditForm({ ...editForm, organizationIds: event.target.checked ? [...editForm.organizationIds, org.id] : editForm.organizationIds.filter(id => id !== org.id) })} />)}
              </div>
            ) : (
              <div className="rounded-lg border border-[#e0e5dd] bg-[#f8faf7] px-3 py-2 text-sm">{editing.organization.name}</div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
