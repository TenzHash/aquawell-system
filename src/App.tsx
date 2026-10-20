import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Droplets,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  RefreshCw,
  ShieldCheck,
  Sun,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { canAccessPage, getCurrentProfile, loadOverview, signOut } from "./lib/data";
import { roleName } from "./utils/formatters";
import { LandingPage } from "./pages/LandingPage";
import { SetupScreen } from "./pages/SetupScreen";
import { DashboardRouter } from "./pages/DashboardRouter";
import { useConfirm, type ConfirmOptions } from "./components/ui/ConfirmDialog";

export default function App() {
  const { confirm } = useConfirm();
  const [session, setSession] = useState<any>(null),
    [profile, setProfile] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState("Overview"),
    [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [dark, setDark] = useState(
      () => localStorage.getItem("aquawell-theme") === "dark",
    ),
    [mobileNav, setMobileNav] = useState(false),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState("");

  const [publicView, setPublicView] = useState(true),
    [authMode, setAuthMode] = useState("login"),
    [authNotice, setAuthNotice] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("aquawell-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase!.auth
      .getSession()
      .then(async ({ data, error }: any) => {
        if (error) throw error;
        if (alive) {
          setSession(data.session);
          if (data.session) await loadProfile(data.session.user.id);
        }
      })
      .catch((e: any) => setError(e.message))
      .finally(() => alive && setLoading(false));

    const { data: sub } = supabase!.auth.onAuthStateChange(
      (event: any, next: any) => {
        // getSession() handles the initial session and profile lookup. Ignoring
        // INITIAL_SESSION here prevents a duplicate, racing profile request that
        // can briefly render the profile-error screen during successful login.
        if (event === "INITIAL_SESSION") return;

        setSession(next);
        if (!next) {
          setProfile(null);
          setData(null);
          setError("");
          setLoading(false);
        } else {
          setLoading(true);
          setError("");
          void loadProfile(next.user.id);
        }
      },
    );
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(id: string) {
    try {
      setError("");
      const p = await getCurrentProfile(id);
      setProfile(p);
      setPage("Overview");
      await refresh(p);
    } catch (e: any) {
      setError(e.message || "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh(p = profile) {
    if (!p) return;
    try {
      setBusy(true);
      const d = await loadOverview(p);
      setData(d);
      setError("");
    } catch (e: any) {
      setError(e.message || "Could not load data.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (
      authMode === "register" &&
      !(await confirm({
        title: "Create your account?",
        message: `A customer account will be created for ${email.trim() || "this email address"}.`,
        confirmLabel: "Create account",
      }))
    )
      return;
    setBusy(true);
    setError("");
    setAuthNotice("");
    try {
      if (authMode === "login") {
        const { error } = await supabase!.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase!.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (!data.session)
          setAuthNotice(
            "Account request submitted. Check your email, then sign in after confirmation. The new account starts with the Customer role.",
          );
        else
          setToast(
            "Account created. Your profile must be provisioned with the intended role before using the system.",
          );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Runs a data-changing operation behind a confirmation dialog.
   * - Every caller is confirmed by default (pass `{ confirm: false }` when the caller
   *   already shows its own dialog, or `{ confirm: {...} }` to customise the wording).
   * - Errors with `silent = true` are expected to be handled by the caller (they skip the
   *   global error banner) but still refresh the data.
   */
  async function action(
    fn: () => Promise<any>,
    success: string,
    options: { confirm?: false | ConfirmOptions } = {},
  ) {
    if (options.confirm !== false) {
      const ok = await confirm({
        title: "Please confirm",
        message: "Are you sure you want to continue with this action?",
        ...(options.confirm || {}),
      });
      if (!ok) return false;
    }
    setBusy(true);
    setError("");
    try {
      await fn();
      setToast(success);
      await refresh();
      return true;
    } catch (e: any) {
      if (e?.silent) await refresh();
      else setError(e.message || "Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (
      !(await confirm({
        title: "Sign out?",
        message: "You will need to sign in again to continue using AquaWell.",
        confirmLabel: "Sign out",
        tone: "warning",
      }))
    )
      return;
    // Logout is intentionally separate from the shared action() helper:
    // action() refreshes protected dashboard data after the operation, which
    // can trigger RLS errors after the Supabase session has been cleared.
    setBusy(true);
    setError("");
    setToast("");
    try {
      await signOut();
      setSession(null);
      setProfile(null);
      setData(null);
      setPage("Overview");
      setMobileNav(false);
    } catch (e: any) {
      // Only report an actual sign-out failure; never run dashboard queries here.
      setError(e?.message || "Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const nav = useMemo<[string, React.ElementType][]>(() => {
    if (!profile) return [];
    const common: [string, React.ElementType][] = [
      ["Overview", LayoutDashboard],
      ["Notifications", Bell],
    ];
    if (profile.role === "admin")
      return [
        ...common,
        ["Orders", ClipboardList],
        ["Rider Status", Truck],
        ["Companies", Building2],
        ["Inventory", Package],
        ["Payments", CircleDollarSign],
        ["Sales & Forecasts", Activity],
        ["People & Roles", Users],
        ["Audit Log", ShieldCheck],
        ["Account", UserRound],
      ];
    if (profile.role === "staff")
      return [
        ...common,
        ["Orders", ClipboardList],
        ["Rider Status", Truck],
        ["Payments", CircleDollarSign],
        ["Customers", Users],
        ["Companies", Building2],
        ["Account", UserRound],
      ];
    if (profile.role === "delivery")
      return [...common, ["My Deliveries", Truck], ["Account", UserRound]];
    return [
      ...common,
      ["Order", Droplets],
      ["My Orders", ClipboardList],
      ["Account", UserRound],
    ];
  }, [profile]);

  if (!supabaseConfigured && !publicView)
    return <SetupScreen onBack={() => setPublicView(true)} />;

  if (loading)
    return (
      <div className="loading">
        <div className="brand-mark">
          <Droplets />
        </div>
        <strong>AquaWell</strong>
        <span>Preparing your workspace…</span>
      </div>
    );

  if (session && !profile)
    return (
      <div className="setup-page">
        <div className="setup-card">
          <span className="brand-mark">
            <ShieldCheck />
          </span>
          <p className="eyebrow">ACCOUNT ACCESS CHECK</p>
          <h1>Profile setup required</h1>
          <p className="muted">
            {error ||
              "Your authenticated account does not have a usable AquaWell profile."}
          </p>
          <p className="muted">
            For security, the app will not guess your role or route you to the
            Customer portal. Ask the administrator to repair the matching
            public.profiles and, for riders, public.staff record.
          </p>
          <button
            className="btn primary"
            onClick={async () => {
              if (await confirm({ title: "Sign out?", message: "You will be returned to the sign-in page.", confirmLabel: "Sign out", tone: "warning" })) void supabase!.auth.signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );

  if (!session || !profile) {
    if (publicView)
      return (
        <LandingPage
          onLogin={() => {
            setAuthMode("login");
            setError("");
            setAuthNotice("");
            setPublicView(false);
          }}
          onRegister={() => {
            setAuthMode("register");
            setError("");
            setAuthNotice("");
            setPublicView(false);
          }}
          dark={dark}
          setDark={setDark}
        />
      );
    return (
      <div className="auth-page">
        <div className="auth-visual">
          <div className="auth-brand">
            <span className="brand-mark">
              <Droplets />
            </span>
            <span>
              AquaWell<small>WATER REFILLING STATION</small>
            </span>
          </div>
          <div className="auth-message">
            <span className="eyebrow">CLEAN WATER. CLEAR OPERATIONS.</span>
            <h1>
              Every drop,
              <br />
              well managed.
            </h1>
            <p>
              Orders, inventory, payments and deliveries in one dependable
              workspace.
            </p>
            <div className="water-art">
              <div className="wave wave-a" />
              <div className="wave wave-b" />
              <div className="water-drop">
                <Droplets size={54} />
              </div>
            </div>
          </div>
          <div className="auth-foot">AquaWell Management System</div>
        </div>
        <div className="auth-panel">
          <div className="auth-mobile-brand">
            <span className="brand-mark">
              <Droplets />
            </span>
            <strong>AquaWell</strong>
          </div>
          <div className="auth-card">
            <span className="eyebrow">WELCOME TO AQUAWELL</span>
            <h2>
              {authMode === "login"
                ? "Sign in to continue"
                : "Create your account"}
            </h2>
            <p className="muted">
              {authMode === "login"
                ? "Access your role-specific workspace securely."
                : "Create a customer account to get started."}
            </p>
            {authNotice && <div className="alert info">{authNotice}</div>}
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={submitAuth} className="form-stack">
              {authMode === "register" && (
                <label>
                  Full name
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={
                      authMode === "login" ? "current-password" : "new-password"
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <button className="btn primary full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : authMode === "login"
                    ? "Sign in securely"
                    : "Create account"}
                <ArrowRight size={17} />
              </button>
            </form>
            <div className="auth-switch">
              {authMode === "login" ? "New customer? " : "Already registered? "}
              <button
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setError("");
                  setAuthNotice("");
                }}
              >
                {authMode === "login" ? "Create account" : "Sign in"}
              </button>
            </div>
            <p className="fine-print">
              <ShieldCheck size={14} /> {"Access is determined by your verified database role. No automatic Customer fallback."}
            </p>
          </div>
          <div className="auth-bottom">
            Need staff or rider access? Contact the station administrator.
          </div>
        </div>
      </div>
    );
  }

  const filteredOrders = (data?.orders || []).filter((o: any) =>
    [
      o.id, o.order_reference, o.status, o.payment_status, o.payment_method,
      o.type, o.address, o.customer_name, o.full_name, o.company_name,
      o.affiliation, o.fulfillment_type, o.delivery_address, o.total_amount,
    ].some((value) =>
      String(value ?? "").toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );

  const setCurrentPage = (requestedPage: string) => {
    const safePage = canAccessPage(profile.role, requestedPage) ? requestedPage : "Overview";
    setPage(safePage);
    setMobileNav(false);
    setQuery("");
  };

  const handleProfileUpdated = async (updatedProfile: any) => {
    setProfile(updatedProfile);
    await refresh(updatedProfile);
  };

  return (
    <div className="app-shell">
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
          {nav.map(([label, Icon]) => (
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
              onClick={() => { void handleSignOut(); }}
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

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-button"
              onClick={() => setMobileNav(true)}
            >
              <Menu />
            </button>
            <div>
              <div className="breadcrumb">
                AquaWell <span>/</span> {page}
              </div>
              <h1>
                {page === "Overview"
                  ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${(profile.full_name || "there").split(" ")[0]}`
                  : page}
              </h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button theme-button"
              onClick={() => setDark(!dark)}
              title={dark ? "Switch to light theme" : "Switch to dark theme"}
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button"
              onClick={() => setCurrentPage("Notifications")}
              title="Notifications"
            >
              <Bell size={19} />
              {data?.notifications?.some((n: any) => n.unread) && (
                <i className="notification-dot" />
              )}
            </button>
          </div>
        </header>

        {error && (
          <div className="global-alert">
            <div>
              <strong>Action needs attention</strong>
              <p>{error}</p>
            </div>
            <button className="icon-button" onClick={() => setError("")}>
              <X size={18} />
            </button>
          </div>
        )}

        {toast && (
          <div className="toast">
            <CheckCircle2 size={18} />
            {toast}
            <button onClick={() => setToast("")}>
              <X size={16} />
            </button>
          </div>
        )}

        <section className="content">
          <div className="page-toolbar">
            <div>
              <p className="page-kicker">
                {profile.role === "customer"
                  ? "YOUR WATER, ON YOUR SCHEDULE"
                  : profile.role === "delivery"
                    ? "TODAY’S ROUTE AND HANDOFFS"
                    : "STATION OPERATIONS"}
              </p>
              <p className="page-subtitle">
                {page === "Overview"
                  ? "Here’s what is happening across your workspace."
                  : page === "Order"
                    ? "Pick your water and supplies, then place your order."
                    : `Manage ${page.toLowerCase()} with clear, up-to-date records.`}
              </p>
            </div>
            <div className="toolbar-actions">
              <button
                className="btn secondary"
                onClick={() => refresh()}
                disabled={busy}
              >
                <RefreshCw size={16} className={busy ? "spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          {busy && !data ? (
            <div className="skeleton-grid">
              <div />
              <div />
              <div />
            </div>
          ) : (
            <DashboardRouter
              page={page}
              profile={profile}
              data={data || {}}
              orders={filteredOrders}
              query={query}
              setQuery={setQuery}
              busy={busy}
              action={action}
              onNavigate={setCurrentPage}
              onProfileUpdated={handleProfileUpdated}
            />
          )}
        </section>

        <footer className="app-footer">
          <span>© {new Date().getFullYear()} AquaWell</span>
          <span>
            <ShieldCheck size={14} /> Role-secured workspace
          </span>
        </footer>
      </main>
    </div>
  );
}
