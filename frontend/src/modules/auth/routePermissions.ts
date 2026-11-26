export const routePermissions:Record<string,string>={
 '/purchase-requisitions':'feed.procurement.read','/deliveries':'feed.procurement.read','/weighbridge':'feed.weighbridge.read',
 '/rm-store':'feed.rm_store.read','/fm-store':'feed.fm_store.read','/recipes':'feed.recipes.read','/production-orders':'feed.production.read','/material-issues':'feed.production.read','/batches':'feed.production.read',
 '/sales-orders':'feed.sales.read','/dispatches':'feed.sales.read','/invoices':'feed.sales.read',
 '/uoms':'feed.setup.read','/currencies':'feed.setup.read','/categories':'feed.setup.read','/products':'feed.setup.read','/partners':'feed.partners.read','/stores':'feed.setup.read','/bins':'feed.setup.read',
 '/profit-loss':'feed.reports.read','/traceability':'feed.reports.read','/agro/reports':'agro.reports.read',
};
