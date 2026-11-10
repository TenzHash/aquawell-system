import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  MapPinned,
  SlidersHorizontal,
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
  Store,
  ShieldCheck,
  Sun,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabaseConfigured } from "./lib/supabase";
import { authApi, canAccessPage, friendlyError, getCurrentProfile, isDemoMode, loadOverview, signOut } from "./lib/data";
import { demoAccounts } from "./lib/demo";
import { CartProvider } from "./features/cart/CartContext";
import { CartButton, CartDrawer } from "./features/cart/CartDrawer";
import { readStored, writeStored } from "./utils/persist";
import { roleName } from "./utils/formatters";
import { LandingPage } from "./pages/LandingPage";
import { SetupScreen } from "./pages/SetupScreen";
import { DashboardRouter } from "./pages/DashboardRouter";
import { RiderLocationBroadcaster } from "./features/map/riderSharing";
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
    [fullName, setFullName] = useState(""),
    [passwordRecovery, setPasswordRecovery] = useState(false),
    [recoveryPassword, setRecoveryPassword] = useState(""),
    [recoveryConfirm, setRecoveryConfirm] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("aquawell-theme", dark ? "dark" : "light");
  }, [dark]);

  const backendReady = supabaseConfigured || isDemoMode();
  // Tracks whose workspace is already loaded (or loading) so auth events for the same person never reload the app.
  const profileIdRef = useRef<string | null>(null);
  const loadingIdRef = useRef<string | null>(null);
  const lastDataJson = useRef("");
  useEffect(() => {
    if (!backendReady) { setLoading(false); return; }
    let alive = true;
    authApi.getSession()
      .then(async (sess: any) => { if (alive) { setSession(sess); if (sess) await loadProfile(sess.user.id); } })
      .catch((e: any) => setError(friendlyError(e)))
      .finally(() => alive && setLoading(false));
    const off = authApi.onChange((event: string, next: any) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "INITIAL_SESSION") return;
      if (!next) {
        profileIdRef.current = null; loadingIdRef.current = null; lastDataJson.current = "";
        setSession(null); setProfile(null); setData(null); setError(""); setLoading(false);
        return;
      }
      // Switching browser tabs makes Supabase re-announce the same session (SIGNED_IN / TOKEN_REFRESHED).
      // If it is the same person we already have loaded, keep the app exactly as it is — no reload, no loading screen.
      if (profileIdRef.current === next.user.id || loadingIdRef.current === next.user.id) {
        setSession((prev: any) => (prev?.access_token === next.access_token ? prev : next));
        return;
      }
      setSession(next); setLoading(true); setError(""); void loadProfile(next.user.id);
    });
    return () => { alive = false; off(); };
  }, []);

  // Quietly refresh every 20 seconds so order, delivery and payment status stay current without a reload.
  const lastPayments = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!profile) return;
    const t = window.setInterval(() => { if (!document.hidden) void refresh(profile, true); }, 20000);
    return () => window.clearInterval(t);
  }, [profile]);

  async function loadProfile(id: string) {
    loadingIdRef.current = id;
    try {
      setError("");
      const p = await getCurrentProfile(id);
      profileIdRef.current = p.id;
      setProfile(p);
      const defaultPage = p.role === "customer" ? "Order Water" : "Overview";
      const saved = p.role === "customer" ? defaultPage : readStored<string>(`aquawell-page-${p.id}`, defaultPage);
      setPage(canAccessPage(p.role, saved) ? saved : defaultPage);
      if (p.role === "customer") writeStored(`aquawell-page-${p.id}`, "Order Water");
      await refresh(p);
    } catch (e: any) {
      setError(friendlyError(e, "We couldn’t load your account."));
    } finally {
      loadingIdRef.current = null;
      setLoading(false);
    }
  }

  async function refresh(p = profile, quiet = false) {
    if (!p) return;
    try {
      if (!quiet) setBusy(true);
      const d = await loadOverview(p);
      // Real-time style payment updates: tell the person when one of their orders gets paid.
      const seen = lastPayments.current; const next: Record<string, string> = {};
      (d.orders || []).forEach((o: any) => { next[o.id] = o.payment_status; if (quiet && seen[o.id] && seen[o.id] !== "PAID" && o.payment_status === "PAID") setToast(`Payment received for ${o.order_reference || "an order"}.`); });
      lastPayments.current = next;
      let json = "";
      try { json = JSON.stringify(d); } catch { json = ""; }
      if (!json || json !== lastDataJson.current) { lastDataJson.current = json; setData(d); }
      if (!quiet) setError("");
    } catch (e: any) {
      if (!quiet) setError(friendlyError(e, "We couldn’t load your data."));
    } finally {
      if (!quiet) setBusy(false);
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
      if (authMode === "forgot") {
        await authApi.requestPasswordReset(email.trim());
        setAuthNotice("If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.");
        setAuthMode("login");
      } else if (authMode === "login") {
        await authApi.signIn(email.trim(), password);
        if (isDemoMode()) { const sess = await authApi.getSession(); setSession(sess); setLoading(true); await loadProfile(sess.user.id); }
      } else {
        const r = await authApi.signUp(email.trim(), password, fullName.trim());
        if (isDemoMode()) { const sess = await authApi.getSession(); setSession(sess); setLoading(true); await loadProfile(sess.user.id); }
        else if (r.needsEmailConfirmation) setAuthNotice("Almost there! Check your email to confirm your account, then sign in.");
        else setToast("Welcome to AquaWell! Your account is ready.");
      }
    } catch (e: any) {
      setError(friendlyError(e));
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
      else setError(friendlyError(e, "That didn’t work. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function resetSession() { profileIdRef.current = null; loadingIdRef.current = null; lastDataJson.current = ""; setProfile(null); setData(null); setPage("Overview"); setPasswordRecovery(false); setRecoveryPassword(""); setRecoveryConfirm(""); setMobileNav(false); setPublicView(true); lastPayments.current = {}; }

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
      resetSession();
      setSession(null);
      setProfile(null);
      setData(null);
      setMobileNav(false);
    } catch (e: any) {
      // Only report an actual sign-out failure; never run dashboard queries here.
      setError(friendlyError(e, "We couldn’t sign you out. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const nav = useMemo<[string, React.ElementType][]>(() => {
    if (!profile) return [];
    const common: [string, React.ElementType][] = [
      ...(profile.role === "customer" ? [] : [["Overview", LayoutDashboard] as [string, React.ElementType]]),
      ["Notifications", Bell],
    ];
    const ok = (page: string) => canAccessPage(profile.role, page, data?.permissions);
    const all: [string, React.ElementType][] = [
      ["Orders", ClipboardList], ["Live Map", MapPinned], ["Rider Status", Truck], ["Shop Location", Store], ["Customers", Users], ["Companies", Building2],
      ["Inventory", Package], ["Sales & Forecasts", Activity], ["People & Roles", Users], ["Access Control", SlidersHorizontal], ["Audit Log", ShieldCheck],
    ];
    if (profile.role === "admin" || profile.role === "staff")
      return [...common, ...all.filter(([l]) => ok(l)), ["Account", UserRound]];
    if (profile.role === "delivery")
      return [...common, ["My Deliveries", Truck], ...(ok("Live Map") ? [["Live Map", MapPinned] as [string, React.ElementType]] : []), ["Account", UserRound]];
    return [...common, ["Order Water", Droplets], ["My Orders", ClipboardList], ["Account", UserRound]];
  }, [profile, data?.permissions]);

  if (!backendReady && !publicView)
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
          <p className="eyebrow">ACCOUNT</p>
          <h1>Your account isn’t ready yet</h1>
          <p className="muted">
            {error ||
              "We couldn’t find your AquaWell account details."}
          </p>
          <p className="muted">
            Please contact the station administrator so they can finish setting
            up your account.
          </p>
          <button
            className="btn primary"
            onClick={async () => {
              if (await confirm({ title: "Sign out?", message: "You will be returned to the sign-in page.", confirmLabel: "Sign out", tone: "warning" })) { await signOut(); resetSession(); setSession(null); }
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );

  if (passwordRecovery && session) {
    async function submitRecoveredPassword(e: React.FormEvent) {
      e.preventDefault(); setError(""); setAuthNotice("");
      if (recoveryPassword.length < 8) { setError("Use at least 8 characters for your new password."); return; }
      if (recoveryPassword !== recoveryConfirm) { setError("The password confirmation does not match."); return; }
      setBusy(true);
      try {
        await authApi.updateRecoveredPassword(recoveryPassword);
        setPasswordRecovery(false); setRecoveryPassword(""); setRecoveryConfirm("");
        setToast("Your password has been updated successfully.");
      } catch (e: any) { setError(friendlyError(e, "We couldn’t update your password.")); }
      finally { setBusy(false); }
    }
    return <div className="auth-page"><div className="auth-panel recovery-panel"><div className="auth-mobile-brand"><span className="brand-mark"><Droplets /></span><strong>AquaWell</strong></div><div className="auth-card"><span className="eyebrow">ACCOUNT RECOVERY</span><h2>Set a new password</h2><p className="muted">Choose a new password with at least 8 characters.</p>{error && <div className="alert error">{error}</div>}<form className="form-stack" onSubmit={submitRecoveredPassword}><label>New password<input type="password" minLength={8} autoComplete="new-password" required value={recoveryPassword} onChange={e => setRecoveryPassword(e.target.value)} /></label><label>Confirm new password<input type="password" minLength={8} autoComplete="new-password" required value={recoveryConfirm} onChange={e => setRecoveryConfirm(e.target.value)} /></label><button className="btn primary full" disabled={busy}>{busy ? "Updating…" : "Update password"}<ArrowRight size={17} /></button></form></div></div></div>;
  }

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
                : authMode === "forgot" ? "Reset your password" : "Create your account"}
            </h2>
            <p className="muted">
              {authMode === "login"
                ? "Sign in to manage your orders and deliveries."
                : authMode === "forgot" ? "Enter your account email and we’ll send you a secure reset link." : "Create a customer account to get started."}
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
              {authMode !== "forgot" && <label>
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
              </label>}
              <button className="btn primary full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : authMode === "login"
                    ? "Sign in"
                    : authMode === "forgot" ? "Send reset link" : "Create account"}
                <ArrowRight size={17} />
              </button>
            </form>
            {authMode === "login" && <div className="auth-forgot"><button type="button" onClick={() => { setAuthMode("forgot"); setError(""); setAuthNotice(""); }}>Forgot password?</button></div>}
            {authMode === "forgot" && <div className="auth-switch"><button type="button" onClick={() => { setAuthMode("login"); setError(""); setAuthNotice(""); }}>Back to sign in</button></div>}
            {isDemoMode() && authMode === "login" && (
              <div className="demo-accounts" aria-label="Demo accounts">
                <small>Demo accounts (password <b>Demo123!</b>)</small>
                <div>{demoAccounts.map(a => <button type="button" key={a.id} onClick={() => { setEmail(a.email); setPassword(a.password); }}>{a.role === "delivery" ? "Rider" : a.role[0]!.toUpperCase() + a.role.slice(1)} · {a.full_name.split(" ")[0]}</button>)}</div>
              </div>
            )}
            {authMode !== "forgot" && <div className="auth-switch">
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
            </div>}
            <p className="fine-print">
              <ShieldCheck size={14} /> Your information is kept private and secure.
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
    const fallbackPage = profile.role === "customer" ? "Order Water" : "Overview";
    const safePage = canAccessPage(profile.role, requestedPage, data?.permissions) ? requestedPage : fallbackPage;
    setPage(safePage);
    writeStored(`aquawell-page-${profile.id}`, safePage);
    setMobileNav(false);
    setQuery("");
  };

  const handleProfileUpdated = async (updatedProfile: any) => {
    setProfile(updatedProfile);
    await refresh(updatedProfile);
  };

  const shell = (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Droplets />
          </span>
          <span>
            AquaWell<small>WATER STATION</small>
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
            {profile.role === "customer" && <CartButton />}
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

        {/* Riders share their GPS position automatically while a delivery is out; this stays mounted on every page. */}
        {profile.role === "delivery" && <RiderLocationBroadcaster active={(data?.orders || []).some((o: any) => o.rider_id === profile.id && o.type === "Delivery" && o.status === "OUT FOR-DELIVERY" && !o.customer_received_at)} />}

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
                  : page === "Order Water"
                    ? "Pick your water and supplies, then check out from your cart."
                    : page === "Live Map" ? "Follow deliveries as they happen." : page === "Shop Location" ? "Pin your shop on the map." : `Manage ${page.toLowerCase()} with clear, up-to-date records.`}
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
              onAccountDeleted={() => { resetSession(); setSession(null); setToast("Your account was deleted. Thank you for using AquaWell."); }}
            />
          )}
        </section>

        <footer className="app-footer">
          <span>© {new Date().getFullYear()} AquaWell</span>
          <span>
            <ShieldCheck size={14} /> Secure workspace
          </span>
        </footer>
      </main>
    </div>
  );

  return profile.role === "customer" ? (
    <CartProvider userId={profile.id} defaultAddress={profile.address || ""} defaultPin={profile.pin_lat != null && profile.pin_lng != null ? { lat: Number(profile.pin_lat), lng: Number(profile.pin_lng) } : null}>
      {shell}
      <CartDrawer inventory={data?.inventory || []} action={action} onNavigate={setCurrentPage} profile={profile} station={data?.station} onProfileUpdated={handleProfileUpdated}
        hasActiveDelivery={(data?.orders || []).some((o: any) => o.type === "Delivery" && ["PENDING", "CONFIRMED", "OUT FOR-DELIVERY"].includes(o.status))} />
    </CartProvider>
  ) : shell;
}
