import React, { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { dateFmt, roleName } from "../../utils/formatters";
import { EmptyState } from "../../components/ui/EmptyState";
import { updateUserRole } from "../../lib/data";
import { TablePagination, TableToolbar } from "../../components/ui/TableControls";

export function PeopleAndRoles({ profiles, action, busy }: any) {
  const [stagedRoles, setStagedRoles] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const filteredProfiles = profiles.filter((p: any) => [p.full_name, p.email, p.role, p.id].some((value: any) => String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(filteredProfiles.length / rowsPerPage));
  const visibleProfiles = filteredProfiles.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  React.useEffect(() => setPage(1), [query, rowsPerPage]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>People & role assignments</h2>
          <p>
            Assign roles to accounts. Employees should register normally, then
            be promoted to Staff or Delivery here.
          </p>
        </div>
        <span className="count-chip">{profiles.length} profiles</span>
      </div>
      <TableToolbar query={query} onQueryChange={setQuery} placeholder="Search people by name, email or role…" label="Search people and roles" rowsPerPage={rowsPerPage} onRowsPerPageChange={setRowsPerPage} resultCount={filteredProfiles.length} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Email</th>
              <th>Current Role</th>
              <th>Joined</th>
              <th>Manage Role</th>
            </tr>
          </thead>
          <tbody>
            {visibleProfiles.map((p: any) => {
              const selectedRole = stagedRoles[p.id] || p.role;
              const hasChanged = selectedRole !== p.role;

              return (
                <tr key={p.id}>
                  <td data-label="Account">
                    <strong>{p.full_name || "Unnamed profile"}</strong>
                    
                  </td>
                  <td data-label="Email">{p.email}</td>
                  <td data-label="Current Role">
                    <span className="role-chip">
                      {roleName(String(p.role || "").toLowerCase())}
                    </span>
                  </td>
                  <td data-label="Joined">{dateFmt(p.created_at)}</td>
                  <td data-label="Manage Role" className="action-cell">
                    <div className="role-manage">
                      <select
                        className="compact-select"
                        value={selectedRole}
                        onChange={(e) =>
                          setStagedRoles((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="customer">Customer</option>
                        <option value="delivery">Delivery Rider</option>
                        <option value="staff">Station Staff</option>
                        <option value="admin">Admin / Owner</option>
                      </select>
                      {/* Always rendered so the column never changes width when a role is staged. */}
                      <button
                        className={`btn small primary role-save ${hasChanged ? "" : "is-hidden"}`}
                        disabled={busy || !hasChanged}
                        tabIndex={hasChanged ? 0 : -1}
                        aria-hidden={!hasChanged}
                        onClick={() =>
                          action(
                            () => updateUserRole(p.id, selectedRole),
                            `${p.full_name || p.email} updated to ${roleName(selectedRole)}.`,
                            { confirm: { title: "Change this role?", message: `${p.full_name || p.email} will change from ${roleName(p.role)} to ${roleName(selectedRole)}. Their access changes immediately.`, confirmLabel: "Change role", tone: "warning" } },
                          )
                        }
                      >
                        <Check size={14} /> Save
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredProfiles.length && (
          <EmptyState
            title="No visible profiles"
            text="No accounts to show."
          />
        )}
      </div>
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} start={filteredProfiles.length ? (page - 1) * rowsPerPage + 1 : 0} end={Math.min(page * rowsPerPage, filteredProfiles.length)} total={filteredProfiles.length} />
    </section>
  );
}
