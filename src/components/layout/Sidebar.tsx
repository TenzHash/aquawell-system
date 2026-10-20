import React from "react";
import { Droplets, LogOut, X } from "lucide-react";
import { roleName } from "../../utils/formatters";
import { signOut } from "../../lib/data";

export function Sidebar({
  mobileNav,
  setMobileNav,
  nav,
  page,
  setCurrentPage,
  profile,
  data,
  action,
}: any) {
  return (
    <>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Droplets />
          </span>
          <span>
            AquaWell<small>MANAGEMENT</small>
          </span>
          <button
            className="icon-button close-nav"
            onClick={() => setMobileNav(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(([label, Icon]: [string, any]) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={() => setCurrentPage(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Orders" &&
                data?.orders?.some((o: any) => o.status === "PENDING") && (
                  <i className="nav-dot" />
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar">
              {(profile.full_name || profile.email || "A")
                .slice(0, 1)
                .toUpperCase()}
            </div>
            <div className="profile-mini-copy">
              <strong>{profile.full_name || profile.email}</strong>
              <small>{roleName(profile.role)}</small>
            </div>
            <button
              className="icon-button"
              onClick={() => action(signOut, "Signed out.")}
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {mobileNav && (
        <button
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
    </>
  );
}
