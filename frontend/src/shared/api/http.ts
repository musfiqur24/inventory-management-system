const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export const selectedOrg = () => localStorage.getItem("inventory.organizationId") ?? "";
export const selectedOrgName = () => localStorage.getItem("inventory.organizationName") ?? "";
export const selectedOrgCode = () => localStorage.getItem("inventory.organizationCode") ?? "";

export const setOrganizationDetails = (org: { id: string; name: string; code?: string }) => {
  localStorage.setItem("inventory.organizationId", org.id);
  localStorage.setItem("inventory.organizationName", org.name);
  if (org.code) localStorage.setItem("inventory.organizationCode", org.code);
  window.dispatchEvent(new CustomEvent("organizationChanged", { detail: org }));
};

export const api = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const organizationId = selectedOrg();
  if (organizationId) headers.set("x-organization-id", organizationId);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Request failed");
  return body as T;
};
