import { twMerge } from 'tailwind-merge';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { selectedOrg, selectedOrgName, ensureOrgDetails, setOrganizationDetails } from '../../shared/api/http';
import { useAuth } from '../../modules/auth/AuthContext';
import { Dropdown } from '../ui/Dropdown';

type Item = { path: string; label: string; icon: LucideIcon };
export type SidebarGroup = { label: string; items: Item[]; icon?: LucideIcon; children?: SidebarGroup[] };

interface SidebarProps {
  groups: SidebarGroup[];
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ groups, mobileOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [orgId, setOrgId] = useState<string>(() => selectedOrg());
  const [orgName, setOrgName] = useState<string>(() => selectedOrgName());

  useEffect(() => {
    void ensureOrgDetails();
    const handler = () => {
      setOrgId(selectedOrg());
      setOrgName(selectedOrgName());
    };
    window.addEventListener('organizationChanged', handler);
    return () => window.removeEventListener('organizationChanged', handler);
  }, []);

  const containsPage = (group: SidebarGroup): boolean =>
    group.items.some(item => item.path === pathname) || Boolean(group.children?.some(containsPage));

  const renderLinks = (group: SidebarGroup, label?: string) => (
    <nav aria-label={group.label} className="grid gap-1">
      {group.items.map(item => (
        <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onClose}
          className={({ isActive }) => twMerge(
            'group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium leading-5 text-white/70 transition-colors hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d548]',
            isActive && 'bg-[#a8d548]/12 font-semibold text-[#c8e87a] before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-[#a8d548]',
          )}>
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/5 transition-colors group-hover:bg-white/10 group-aria-[current=page]:bg-[#a8d548]/15"><item.icon size={17} strokeWidth={1.75} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">{label ?? item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  const renderGroup = (group: SidebarGroup, parent = '') => {
    const key = parent ? parent + '/' + group.label : group.label;
    const isModule = Boolean(group.children);
    const active = containsPage(group);
    const isCollapsed = collapsed[key] ?? (isModule && !active);
    const panelId = 'sidebar-' + key.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!parent && !isModule) {
      return <div key={key} className={group.label === 'Administration' ? 'mt-5 border-t border-white/10 pt-4' : ''}>
        {renderLinks(group, group.label === 'Dashboard' ? 'Dashboard' : undefined)}
      </div>;
    }

    return (
      <div key={key}>
        <button type="button" aria-expanded={!isCollapsed} aria-controls={panelId}
          onClick={() => setCollapsed(current => ({ ...current, [key]: !isCollapsed }))}
          className={twMerge(
            'flex w-full items-center gap-3 rounded-lg border-0 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d548]',
            isModule
              ? 'min-h-11 px-3 py-2 text-[13px] font-semibold leading-5 text-white/80 hover:bg-white/6 hover:text-white'
              : 'min-h-9 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45 hover:text-white/80',
            isModule && active && 'bg-white/6 text-[#c8e87a]',
          )}>
          {group.icon && <span className={twMerge("grid size-7 shrink-0 place-items-center rounded-lg bg-white/5", active && "bg-[#a8d548]/15")}><group.icon size={17} strokeWidth={1.75} aria-hidden="true" /></span>}
          <span className="min-w-0 flex-1">{group.label}</span>
          {isCollapsed ? <ChevronRight size={14} className="shrink-0 text-white/40" /> : <ChevronDown size={14} className="shrink-0 text-white/40" />}
        </button>
        {!isCollapsed && (
          <div id={panelId} className={isModule ? 'mb-2 ml-5 mt-1 grid gap-1 border-l border-white/10 pl-3' : 'pb-1'}>
            {group.items.length > 0 && renderLinks(group)}
            {group.children?.map(child => renderGroup(child, key))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <aside className={twMerge(`sticky top-0 h-dvh overflow-hidden bg-[#0d3b2e] flex flex-col print:hidden! max-[900px]:fixed max-[900px]:z-70 max-[900px]:h-dvh max-[900px]:w-[min(85vw,_280px)] max-[900px]:[transform:translateX(-110%)] max-[900px]:[transition:transform_0.22s_ease] ${(mobileOpen ? "max-[900px]:[transform:translateX(0)]" : "")}`)}>
        {/* Brand */}
        <div className="flex items-center justify-between p-[18px_18px_0] shrink-0 [&_a]:flex [&_a]:items-center [&_a]:gap-3 [&_a]:text-[#fff] [&_a]:no-underline">
          <Link to="/" onClick={onClose}>
            <div className="size-14 shrink-0"><img src="/Inventory_Logo.png" alt="Feed Track" className="size-full object-contain" /></div>
            <div className="[:where(&_strong)]:block [:where(&_strong)]:[font-family:'Outfit',_sans-serif] [:where(&_strong)]:text-[15px] [:where(&_strong)]:font-bold [:where(&_strong)]:text-[#fff] [:where(&_strong)]:leading-[1.2] [:where(&_small)]:block [:where(&_small)]:text-[10.5px] [:where(&_small)]:text-[rgba(255,255,255,0.45)] [:where(&_small)]:mt-0.25">
              <strong>FeedTrack</strong>
              <small>Production Inventory</small>
            </div>
          </Link>
          <button className="hidden [border:0] [background:none] text-[rgba(255,255,255,0.6)] p-1 rounded-[6px] max-[900px]:grid" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Organization workspace */}
        {user?.isSuperAdmin ? (
          <Link className="m-[14px_12px_6px] bg-[rgba(255,255,255,0.06)] [border:1px_solid_rgba(255,255,255,0.08)] rounded-[12px] p-[10px_12px] flex items-center gap-2.5 text-[rgba(255,255,255,0.85)] [transition:background_0.15s] shrink-0 [&:hover]:bg-[rgba(255,255,255,0.10)]" to="/organizations" onClick={onClose}>
            <div className="w-8 h-8 rounded-[8px] bg-[#a8d548] grid place-items-center text-[#0d3b2e] font-extrabold text-[13px] shrink-0">{orgName.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0"><strong className="block truncate text-[12.5px] font-semibold">{orgName}</strong><small className="mt-0.5 block text-[10.5px] text-[rgba(255,255,255,0.4)]">Click to switch</small></div>
          </Link>
        ) : (
          <div className="m-[14px_12px_6px] flex shrink-0 items-center gap-2.5 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] p-[10px_12px] text-[rgba(255,255,255,0.85)]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#a8d548] text-[13px] font-extrabold text-[#0d3b2e]">{orgName.slice(0, 2).toUpperCase()}</div>
            {user && user.organizations.length > 1 ? (
              <Dropdown variant="sidebar" aria-label="Active organization" value={orgId} onChange={(event) => { const org=user.organizations.find(item=>item.id===event.target.value); if(org)setOrganizationDetails(org); }}>
                {user.organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}
              </Dropdown>
            ) : (
              <div className="min-w-0"><strong className="block truncate text-[12.5px] font-semibold">{orgName}</strong><small className="mt-0.5 block text-[10.5px] text-[rgba(255,255,255,0.4)]">Assigned organization</small></div>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-6 pt-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.08)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.1)] [&::-webkit-scrollbar-thumb]:rounded-[4px]">
          <div className="grid gap-1">
            {groups.map(group => (
              <div key={group.label}>
                {renderGroup(group)}
              </div>
            ))}
          </div>
        </div>

      </aside>

      {mobileOpen && (
        <button
          className="hidden max-[900px]:block max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-60 max-[900px]:bg-[rgba(0,0,0,0.45)] max-[900px]:[border:0] max-[900px]:cursor-pointer"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="hidden [border:1px_solid_#e0e5dd] bg-[#f8faf7] rounded-[8px] p-2 text-[#445e50] max-[900px]:grid" onClick={onClick} aria-label="Open menu">
      <Menu size={20} />
    </button>
  );
}
