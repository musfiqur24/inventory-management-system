import { NotificationBell } from "./components/layout/NotificationBell";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Boxes, Building2, ClipboardList, Factory, FlaskConical,
  PackageCheck, Scale, ShoppingCart, Truck, Warehouse, LayoutDashboard,
  GitBranch, ArrowLeftRight, Users, CircleUserRound, LogOut
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { selectedOrgName, ensureOrgDetails } from './shared/api/http';
import { MobileMenuButton, Sidebar } from './components/layout/Sidebar';
import { AppToaster } from './components/ui/Toast';

// Pages
import { OrganizationPage } from './modules/platform/organizations/OrganizationPage';
import { UnitsOfMeasurePage } from './modules/set-up/units-of-measure/UnitsOfMeasurePage';
import { ProductHierarchyPage } from './modules/set-up/product-hierarchy/ProductHierarchyPage';
import { PartnersPage } from './modules/set-up/partners/PartnersPage';
import { StoresPage } from './modules/inventory/stores/StoresPage';
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
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import { LoginPage } from './modules/auth/LoginPage';
import { UserManagementPage } from './modules/users/UserManagementPage';
import { ProfilePage } from './modules/auth/ProfilePage';

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    items: [
      { path: '/', label: 'Overview', icon: LayoutDashboard },
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
    label: 'Master Setup',
    items: [
      { path: '/uoms', label: 'Units of Measure', icon: Scale },
      { path: '/categories', label: 'Product Set Up', icon: Boxes },
      { path: '/partners', label: 'Suppliers & Customers', icon: Building2 },
      { path: '/stores', label: 'Stores & Bins', icon: Warehouse },
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
  const { user, loading, can, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgDisplay, setOrgDisplay] = useState<string>(() => selectedOrgName());
  const [orgRevision, setOrgRevision] = useState(0);
  const location = useLocation();

  useEffect(() => {
    void ensureOrgDetails();
    const handler = () => {
      setOrgDisplay(selectedOrgName());
      setOrgRevision(value => value + 1);
    };
    window.addEventListener('organizationChanged', handler);
    return () => window.removeEventListener('organizationChanged', handler);
  }, []);

  if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-[#61766a]">Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const visibleGroups = NAV_GROUPS.concat(can('users.manage') ? [{ label: 'Administration', items: [{ path: '/users', label: 'User Management', icon: Users }] }] : []).map(g => ({...g, items: g.items.filter(i => i.path !== '/organizations' || can('organizations.manage'))})).filter(g => g.items.length);
  const allItems = visibleGroups.flatMap((g) => g.items);
  const currentItem = allItems.find((item) => item.path === location.pathname);
  const pageTitle = currentItem?.label ?? (location.pathname === '/' ? 'Dashboard' : 'FeedTrack');

  return (
    <>
      <a href="#main-content" className="fixed left-4 top-3 z-100 -translate-y-20 rounded-lg bg-[#0d3b2e] px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0">Skip to content</a>
      <div className="min-h-dvh grid grid-cols-[270px_minmax(0,_1fr)] print:block! max-[900px]:block">
      <Sidebar
        groups={visibleGroups}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <main id="main-content" tabIndex={-1} className="min-h-dvh min-w-0 bg-[#f4f6f3] print:min-w-full">
        <header className="flex h-16 items-center gap-3 sm:h-17 sm:gap-4 px-4 sm:px-6 lg:px-10 xl:px-12 bg-[#fff] [border-bottom:1px_solid_#e0e5dd] sticky top-0 z-10 print:hidden! max-[900px]:p-[0_16px]">
          <div className="flex items-center gap-3 flex-1">
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
            <div className="flex items-center gap-2 text-[13.5px] text-[#7a9185] [:where(&_strong)]:text-[#0f1c16] [:where(&_strong)]:text-[15px] [:where(&_strong)]:font-semibold">
              <span>FeedTrack</span>
              <span aria-hidden="true">/</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell key={orgRevision} />
            {can("organizations.manage") ? <Link to="/organizations"><div className="hidden rounded-full border border-[#e0e5dd] bg-[#f8faf7] px-3 py-1.5 text-xs font-medium text-[#445e50] sm:block">{orgDisplay || "Workspace"}</div></Link> : null}
            <Link to="/profile" className="flex items-center gap-2 rounded-xl border border-[#e0e5dd] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#31483d] hover:bg-[#f8faf7]"><span className="grid size-7 place-items-center rounded-lg bg-[#edf6df] text-[#1a5c45]"><CircleUserRound size={16}/></span><span className="hidden max-w-40 truncate text-sm sm:block">{user.fullName}</span></Link>
            <button onClick={() => void logout()} className="grid size-9 place-items-center rounded-xl border border-[#e0e5dd] text-[#7a9185] hover:border-red-200 hover:bg-red-50 hover:text-red-700" title="Log out" aria-label="Log out"><LogOut size={17}/></button>
          </div>
        </header>

        <Routes key={orgRevision}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/organizations" element={can("organizations.manage") ? <OrganizationPage /> : <Navigate to="/" replace />} />
          <Route path="/uoms" element={<UnitsOfMeasurePage />} />
          <Route path="/categories" element={<ProductHierarchyPage />} />
          <Route path="/products" element={<Navigate to="/categories" replace />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/bins" element={<Navigate to="/stores" replace />} />
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
          <Route path="/users" element={can("users.manage") ? <UserManagementPage /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter><AppToaster /><AuthProvider><Routes><Route path="/login" element={<LoginPage />} /><Route path="/*" element={<Shell />} /></Routes></AuthProvider></BrowserRouter>
  );
}
