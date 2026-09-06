import { twMerge } from 'tailwind-merge';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { selectedOrg, selectedOrgName, ensureOrgDetails, setOrganizationDetails } from '../../shared/api/http';
import { useAuth } from '../../modules/auth/AuthContext';

type Item = { path: string; label: string; icon: LucideIcon };
type Group = { label: string; items: Item[] };

interface SidebarProps {
  groups: Group[];
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ groups, mobileOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
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

  return (
    <>
      <aside className={twMerge(`sticky top-0 h-dvh overflow-y-auto overflow-x-hidden bg-[#0d3b2e] flex flex-col [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.08)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.1)] [&::-webkit-scrollbar-thumb]:rounded-[4px] print:hidden! max-[900px]:fixed max-[900px]:z-30 max-[900px]:h-dvh max-[900px]:w-[min(85vw,_280px)] max-[900px]:[transform:translateX(-110%)] max-[900px]:[transition:transform_0.22s_ease] ${(mobileOpen ? "max-[900px]:[transform:translateX(0)]" : "")}`)}>
        {/* Brand */}
        <div className="flex items-center justify-between p-[20px_18px_0] shrink-0 [&_a]:flex [&_a]:items-center [&_a]:gap-3 [&_a]:text-[#fff] [&_a]:no-underline">
          <Link to="/" onClick={onClose}>
            <div className="w-10 h-10 overflow-hidden rounded-[11px] bg-white p-1 shrink-0"><img src="/Inventory_Logo.png" alt="Feed Track" className="size-full object-contain" /></div>
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
              <select aria-label="Active organization" value={orgId} onChange={(event) => { const org=user.organizations.find(item=>item.id===event.target.value); if(org)setOrganizationDetails(org); }} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-[12.5px] font-semibold text-white outline-none [&_option]:text-[#0d3b2e]">
                {user.organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            ) : (
              <div className="min-w-0"><strong className="block truncate text-[12.5px] font-semibold">{orgName}</strong><small className="mt-0.5 block text-[10.5px] text-[rgba(255,255,255,0.4)]">Assigned organization</small></div>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="flex-1 p-[6px_0_20px]">
          {groups.map((group) => (
            <div key={group.label} className="p-[0_8px] [&+div]:mt-1 [&_nav]:grid [&_nav]:gap-0.5 [&_nav_a]:flex [&_nav_a]:items-center [&_nav_a]:gap-2.5 [&_nav_a]:p-[9px_10px] [&_nav_a]:rounded-[9px] [&_nav_a]:text-[rgba(255,255,255,0.65)] [&_nav_a]:text-[13.5px] [&_nav_a]:font-medium [&_nav_a]:[transition:background_0.12s,_color_0.12s] [&_nav_a_svg]:w-4 [&_nav_a_svg]:h-4 [&_nav_a_svg]:shrink-0 [&_nav_a:hover]:bg-[rgba(255,255,255,0.07)] [&_nav_a:hover]:text-[#fff] [&_nav_a.active]:bg-[rgba(168,213,72,0.14)] [&_nav_a.active]:text-[#c8e87a] [&_nav_a.active]:font-semibold [&_nav_a.active_svg]:text-[#a8d548]">
              <button
                className="flex items-center justify-between w-full p-[12px_10px_6px] [border:0] [background:none] text-[rgba(255,255,255,0.35)] text-[10px] font-bold tracking-[0.10em] uppercase [:where(&_svg)]:w-3.5 [:where(&_svg)]:h-3.5"
                onClick={() => setCollapsed({ ...collapsed, [group.label]: !collapsed[group.label] })}
             >
                <span>{group.label}</span>
                {collapsed[group.label] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!collapsed[group.label] && (
                <nav>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) => isActive ? 'active' : ''}
                   >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
          ))}
        </div>

      </aside>

      {mobileOpen && (
        <button
          className="hidden max-[900px]:block max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-20 max-[900px]:bg-[rgba(0,0,0,0.45)] max-[900px]:[border:0] max-[900px]:cursor-pointer"
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
