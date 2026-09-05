import { api, selectedOrg, selectedOrgName, selectedOrgCode, setOrganizationDetails } from "../../../shared/api/http";

export type Organization = { id: string; code: string; name: string };

export const organizationApi = {
  list: () => api<{ data: Organization[] }>("/organizations"),
  create: (data: { name: string; code: string }) => api<{ data: Organization }>("/organizations", { method: "POST", body: JSON.stringify(data) }),
  select: (org: Organization) => setOrganizationDetails(org),
  selectedId: selectedOrg,
  selectedName: selectedOrgName,
  selectedCode: selectedOrgCode,
};