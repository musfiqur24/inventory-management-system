import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import {
  Boxes, Building2, ClipboardList, Factory, FlaskConical,
  PackageCheck, Scale, ShoppingCart, Truck, Warehouse, LayoutDashboard,
  GitBranch, ArrowLeftRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { selectedOrg, selectedOrgName, ensureOrgDetails } from './shared/api/http';
import { MobileMenuButton, Sidebar } from './components/layout/Sidebar';

// Pages
import { OrganizationPage } from './modules/platform/organizations/OrganizationPage';
import { UnitsOfMeasurePage } from './modules/set-up/units-of-measure/UnitsOfMeasurePage';
import { ProductHierarchyPage } from './modules/set-up/product-hierarchy/ProductHierarchyPage';
import { PartnersPage } from './modules/set-up/partners/PartnersPage';
import { ProductsPage } from './modules/set-up/products/ProductsPage';
import { BinsPage } from './modules/inventory/bin-management/BinsPage';
import { SalesOrdersPage } from './modules/sales/sales-orders/SalesOrdersPage';
import { RmRequisitionsPage } from './modules/procurement/rm-requisitions/RmRequisitionsPage';
import { SupplierChallansPage } from './modules/procurement/supplier-challans/SupplierChallansPage';
import { WeighbridgePage } from './modules/procurement/weighbridge/WeighbridgePage';
import { RmStorePage } from './modules/inventory/rm-store/RmStorePage';
import { RecipesPage } from './modules/production/recipes/RecipesPage';
import { ProductionOrdersPage } from './modules/production/fm-requisitions/ProductionOrdersPage';
import { MaterialIssuesPage } from './modules/production/material-issues/MaterialIssuesPage';
import { ProductionBatchesPage } from './modules/production/batches/ProductionBatchesPage';
import { FmStorePage } from './modules/inventory/fm-store/FmStorePage';
import { DispatchesPage } from './modules/sales/dispatches/DispatchesPage';
import { TraceabilityPage } from './modules/traceability/TraceabilityPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    items: [
      { path: '/', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Master Setup',
    items: [
      { path: '/uoms', label: 'Units of Measure', icon: Scale },
      { path: '/categories', label: 'Product Hierarchy', icon: Boxes },
      { path: '/products', label: 'Products (L5 SKUs)', icon: FlaskConical },
      { path: '/partners', label: 'Suppliers & Customers', icon: Building2 },
      { path: '/bins', label: 'Warehouse Bins', icon: Warehouse },
    ],
  },
  {
    label: 'RM Procurement',
    items: [
      { path: '/sales-orders', label: 'Sales Orders', icon: ShoppingCart },
      { path: '/purchase-requisitions', label: 'RM Requisitions', icon: ClipboardList },
      { path: '/deliveries', label: 'Supplier Challans', icon: Truck },
      { path: '/weighbridge', label: 'Weighbridge Station', icon: Scale },
      { path: '/rm-store', label: 'RM Store & Lots', icon: Warehouse },
    ],
  },
  {
    label: 'Production',
    items: [
      { path: '/recipes', label: 'Nutritionist Recipes', icon: FlaskConical },
      { path: '/production-orders', label: 'FM Requisitions', icon: Factory },
      { path: '/material-issues', label: 'Issue RM to Factory', icon: ArrowLeftRight },
      { path: '/batches', label: 'Factory Batches', icon: Factory },
      { path: '/fm-store', label: 'FM Store', icon: PackageCheck },
    ],
  },
  {
    label: 'Sales & Reports',
    items: [
      { path: '/dispatches', label: 'FM Dispatches', icon: Truck },
      { path: '/traceability', label: 'Traceability', icon: GitBranch },
    ],
  },
];

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgDisplay, setOrgDisplay] = useState<string>(() => selectedOrgName());
  const location = useLocation();

  useEffect(() => {
    void ensureOrgDetails();
    const handler = () => {
      setOrgDisplay(selectedOrgName());
    };
    window.addEventListener('organizationChanged', handler);
    return () => window.removeEventListener('organizationChanged', handler);
  }, []);

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentItem = allItems.find((item) => item.path === location.pathname);
  const pageTitle = currentItem?.label ?? (location.pathname === '/' ? 'Dashboard' : 'FeedTrack');

  return (
    <div className="app-shell">
      <Sidebar
        groups={NAV_GROUPS}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <main className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__left">
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
            <div className="app-topbar__breadcrumb">
              <span>FeedTrack</span>
              <span>›</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>
          <div className="app-topbar__right">
            <Link to="/organizations">
              <div className="app-topbar__org-badge">
                <div className="app-topbar__org-dot" />
                {orgDisplay ? orgDisplay : (selectedOrg() ? 'Loading…' : 'Select Organisation')}
              </div>
            </Link>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/organizations" element={<OrganizationPage />} />
          <Route path="/uoms" element={<UnitsOfMeasurePage />} />
          <Route path="/categories" element={<ProductHierarchyPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/bins" element={<BinsPage />} />
          <Route path="/sales-orders" element={<SalesOrdersPage />} />
          <Route path="/purchase-requisitions" element={<RmRequisitionsPage />} />
          <Route path="/deliveries" element={<SupplierChallansPage />} />
          <Route path="/weighbridge" element={<WeighbridgePage />} />
          <Route path="/rm-store" element={<RmStorePage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/production-orders" element={<ProductionOrdersPage />} />
          <Route path="/material-issues" element={<MaterialIssuesPage />} />
          <Route path="/batches" element={<ProductionBatchesPage />} />
          <Route path="/fm-store" element={<FmStorePage />} />
          <Route path="/dispatches" element={<DispatchesPage />} />
          <Route path="/traceability" element={<TraceabilityPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}