import { featureApi } from "./api";
import { ResourcePage } from '../../../pages/ResourcePage';

export function SalesOrdersPage() {
  return <ResourcePage title="Sales orders" subtitle="Capture customer demand that drives procurement and dispatch." resource={featureApi.resource} report fields={[]}/>;
}


