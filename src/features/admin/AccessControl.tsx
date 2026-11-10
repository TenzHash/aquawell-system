import React from "react";
import { ShieldCheck, Truck, UserCog } from "lucide-react";
import { PERMISSIONS, can, type PermissionMap } from "../../lib/permissions";
import { setRolePermission } from "../../lib/data";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";

const ROLES: { key: "staff" | "delivery"; title: string; blurb: string; icon: React.ElementType }[] = [
  { key: "staff", title: "Station staff", blurb: "Counter and back-office team.", icon: UserCog },
  { key: "delivery", title: "Delivery riders", blurb: "Riders on the road.", icon: Truck },
];

/** Admin-only switchboard: turn individual abilities on or off for staff and riders. Changes apply immediately. */
export function AccessControl({ permissions, action, busy }: { permissions?: PermissionMap; action: any; busy: boolean }) {
  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="panel-heading"><div><h2><ShieldCheck size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Access control</h2>
          <p>Decide what station staff and delivery riders can see and do. Administrators always have full access. Changes take effect right away.</p></div></div>
        <div className="permission-grid">
          {ROLES.map(r => {
            const Icon = r.icon; const defs = PERMISSIONS.filter(p => p.roles.includes(r.key));
            return (
              <div className="permission-card" key={r.key}>
                <header><span className="avatar"><Icon size={18} /></span><div><h3>{r.title}</h3><small>{r.blurb}</small></div>
                  <span className="count-chip">{defs.filter(d => can(r.key, permissions, d.key)).length}/{defs.length} allowed</span></header>
                <ul>
                  {defs.map(d => {
                    const on = can(r.key, permissions, d.key);
                    return (
                      <li key={d.key}>
                        <div><strong>{d.label}</strong><small>{d.description}</small></div>
                        <ToggleSwitch checked={on} disabled={busy} label={`${d.label} for ${r.title}`} onText="Allowed" offText="Blocked"
                          onChange={next => action(() => setRolePermission(r.key, d.key, next), `${d.label}: ${next ? "allowed" : "blocked"} for ${r.title.toLowerCase()}.`,
                            { confirm: { title: next ? "Allow this?" : "Block this?", message: `${next ? "Allow" : "Block"} “${d.label}” for ${r.title.toLowerCase()}. This applies to everyone with that role.`, confirmLabel: next ? "Allow" : "Block", tone: next ? "primary" : "warning" } })} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
