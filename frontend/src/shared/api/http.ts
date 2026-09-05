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

export const ensureOrgDetails = async (): Promise<string> => {
  const currentName = selectedOrgName();
  if (currentName) return currentName;
  const currentId = selectedOrg();
  if (!currentId) return "";
  try {
    const result = await api<{ data: { id: string; name: string; code?: string }[] }>("/organizations");
    const found = result.data.find((o) => o.id === currentId);
    if (found) {
      setOrganizationDetails(found);
      return found.name;
    }
  } catch {
    // Silent catch if API is loading or network error
  }
  return "";
};

export const api = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const organizationId = selectedOrg();
  if (organizationId) headers.set("x-organization-id", organizationId);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: text || `HTTP ${response.status} ${response.statusText}` } };
  }

  if (!response.ok) {
    throw new Error(body.error?.message ?? body.message ?? `Request failed (${response.status})`);
  }
  return body as T;
};
