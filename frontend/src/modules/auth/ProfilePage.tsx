import { useState } from "react";
import { Building2, Mail, MapPin, Pencil, Phone, ShieldCheck } from "lucide-react";
import { PageContainer } from "../../components/ui/PageContainer";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { TextArea } from "../../components/ui/TextArea";
import { FormField } from "../../components/ui/FormField";
import { Badge } from "../../components/ui/Badge";
import { appToast } from "../../components/ui/Toast";
import { useAuth } from "./AuthContext";

const emptyValue = "Not provided";

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName ?? "",
    avatarUrl: user?.avatarUrl ?? "",
    phone: user?.phone ?? "",
    presentAddress: user?.presentAddress ?? "",
    permanentAddress: user?.permanentAddress ?? "",
  });

  if (!user) return null;

  const resetForm = () => {
    setForm({
      fullName: user.fullName,
      avatarUrl: user.avatarUrl ?? "",
      phone: user.phone ?? "",
      presentAddress: user.presentAddress ?? "",
      permanentAddress: user.permanentAddress ?? "",
    });
  };

  const cancelEdit = () => {
    resetForm();
    setEditing(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      await updateProfile({
        fullName: form.fullName.trim(),
        avatarUrl: form.avatarUrl.trim() || null,
        phone: form.phone.trim() || null,
        presentAddress: form.presentAddress.trim() || null,
        permanentAddress: form.permanentAddress.trim() || null,
      });
      setEditing(false);
      appToast.success("Profile updated successfully.");
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer cap="ACCOUNT" title="My Profile" description="Manage your personal information and view your organization access.">
      <Card>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#e0e5dd] pb-5">
          <div>
            <h2 className="text-lg font-bold text-[#0f1c16]">Personal details</h2>
            <p className="mt-1 text-sm text-[#7a9185]">Your contact and address information.</p>
          </div>
          {!editing && <Button type="button" onClick={() => setEditing(true)}><Pencil size={15} /> Edit profile</Button>}
        </div>

        {editing ? (
          <form onSubmit={save}>
            <div className="grid gap-x-5 md:grid-cols-2">
              <FormField label="Full name" required>
                <Input required minLength={2} maxLength={100} value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} />
              </FormField>
              <FormField label="Email address" hint="Email cannot be changed from your profile.">
                <Input type="email" disabled value={user.email} className="cursor-not-allowed bg-[#f3f5f2] text-[#7a9185]" />
              </FormField>
              <FormField label="Phone number">
                <Input type="tel" maxLength={30} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+880 1XXX-XXXXXX" />
              </FormField>
              <FormField label="Picture URL">
                <Input type="url" value={form.avatarUrl} onChange={event => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://example.com/profile.jpg" />
              </FormField>
              <FormField label="Present address">
                <TextArea maxLength={500} value={form.presentAddress} onChange={event => setForm({ ...form, presentAddress: event.target.value })} placeholder="Current residential address" />
              </FormField>
              <FormField label="Permanent address">
                <TextArea maxLength={500} value={form.permanentAddress} onChange={event => setForm({ ...form, permanentAddress: event.target.value })} placeholder="Permanent residential address" />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end gap-3 border-t border-[#e0e5dd] pt-5">
              <Button type="button" onClick={cancelEdit}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[#f8faf7] p-7 text-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="size-28 rounded-3xl border-4 border-white object-cover shadow-sm" />
              ) : (
                <div className="grid size-28 place-items-center rounded-3xl bg-[#edf6df] text-4xl font-bold text-[#1a5c45]">{user.fullName.charAt(0).toUpperCase()}</div>
              )}
              <h3 className="mt-4 text-xl font-bold text-[#0f1c16]">{user.fullName}</h3>
              <p className="mt-1 text-sm text-[#7a9185]">{user.email}</p>
              <div className="mt-4"><Badge variant="green">Active account</Badge></div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e0e5dd] p-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a9185]"><Mail size={15} /> Email address</dt>
                <dd className="mt-2 break-all text-sm font-semibold text-[#253c31]">{user.email}</dd>
              </div>
              <div className="rounded-xl border border-[#e0e5dd] p-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a9185]"><Phone size={15} /> Phone number</dt>
                <dd className="mt-2 text-sm font-semibold text-[#253c31]">{user.phone || emptyValue}</dd>
              </div>
              <div className="rounded-xl border border-[#e0e5dd] p-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a9185]"><MapPin size={15} /> Present address</dt>
                <dd className="mt-2 whitespace-pre-line text-sm leading-6 text-[#253c31]">{user.presentAddress || emptyValue}</dd>
              </div>
              <div className="rounded-xl border border-[#e0e5dd] p-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a9185]"><MapPin size={15} /> Permanent address</dt>
                <dd className="mt-2 whitespace-pre-line text-sm leading-6 text-[#253c31]">{user.permanentAddress || emptyValue}</dd>
              </div>
            </dl>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e5dd] pb-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0f1c16]"><Building2 size={19} className="text-[#1a5c45]" /> Assigned organizations</h2>
            <p className="mt-1 text-sm text-[#7a9185]">Organizations and roles assigned to your account.</p>
          </div>
          <Badge variant="blue">{String(user.organizations.length) + " assigned"}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {user.organizations.map(organization => (
            <div key={organization.id} className="flex items-center gap-3 rounded-xl border border-[#e0e5dd] bg-[#fbfcfa] p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf6df] font-bold text-[#1a5c45]">{organization.name.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#0f1c16]">{organization.name}</div>
                <div className="mt-0.5 text-xs text-[#7a9185]">{organization.code}</div>
              </div>
              <Badge variant="brand">{organization.role.name}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#edf6df] text-[#1a5c45]"><ShieldCheck size={20} /></div>
          <div>
            <h2 className="text-base font-bold text-[#0f1c16]">Account access</h2>
            <p className="mt-1 text-sm text-[#7a9185]">{user.isSuperAdmin ? "System-wide Super Admin access" : user.organizations.map(item => item.role.name).filter((role, index, roles) => roles.indexOf(role) === index).join(", ")}</p>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
