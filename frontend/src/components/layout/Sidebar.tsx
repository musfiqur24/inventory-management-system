import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { selectedOrg, selectedOrgName, ensureOrgDetails } from '../../shared/api/http';

type Item = { path: string; label: string; icon: LucideIcon };
type Group = { label: string; items: Item[] };

interface SidebarProps {
  groups: Group[];
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ groups, mobileOpen, onClose }: SidebarProps) {
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
      <aside className={`app-sidebar ${mobileOpen ? 'app-sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="app-sidebar__brand">
          <Link to="/" onClick={onClose}>
            <div className="app-sidebar__brand-icon">F</div>
            <div className="app-sidebar__brand-text">
              <strong>FeedTrack</strong>
              <small>Production Inventory</small>
            </div>
          </Link>
          <button className="app-sidebar__close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Organization switcher */}
        <Link className="app-sidebar__org" to="/organizations" onClick={onClose}>
          <div className="app-sidebar__org-icon">
            {orgName ? orgName.slice(0, 2).toUpperCase() : 'ORG'}
          </div>
          <div className="app-sidebar__org-text">
            <strong>{orgName ? orgName : (orgId ? 'Loading…' : 'No org selected')}</strong>
            <small>{orgId ? 'Click to switch' : 'Click to choose'}</small>
          </div>
        </Link>

        {/* Nav */}
        <div className="app-sidebar__nav">
          {groups.map((group) => (
            <div key={group.label} className="app-sidebar__group">
              <button
                className="app-sidebar__group-label"
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

        {/* Role indicator */}
        <div className="app-sidebar__role">
          <div className="app-sidebar__role-dot" />
          <span>All Roles View</span>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="app-sidebar__backdrop"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="app-mobile-menu" onClick={onClick} aria-label="Open menu">
      <Menu size={20} />
    </button>
  );
}
