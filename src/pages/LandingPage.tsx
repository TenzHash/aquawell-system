import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Droplets,
  Mail,
  MapPin,
  Menu,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  Truck,
  X,
  PackageCheck,
  Receipt,
} from "lucide-react";
import { STATION } from "../config/station";

/** Hero picture. Replace public/images/hero-placeholder.svg with your own photo (or point this at a .jpg/.png/.webp in public/images). */
const HERO_IMAGE = "/images/images.jpg";

/** Scroll-driven parallax: each [data-depth] element drifts at its own speed. Disabled for reduced-motion users. */
function useParallax(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // The pinned hero photo always applies. Only the extra drifting layers (bubbles, glass...) respect reduced motion.
    const reduceMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const layers = reduceMotion ? [] : Array.from(el.querySelectorAll<HTMLElement>("[data-depth]"));
    const photo = el.querySelector<HTMLElement>(".px-photo");
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      // Hero photo must stay put on screen. It is position:fixed in CSS; if some ancestor (transform, preview frame,
      // etc.) breaks that, measure where it really is and cancel the drift so it still behaves like a fixed background.
      if (photo) {
        const cur = Number(photo.dataset.shift || 0);
        const base = photo.getBoundingClientRect().top - cur;
        const shift = Math.abs(base) > 1 ? -base : 0;
        if (shift !== cur) {
          photo.dataset.shift = String(shift);
          photo.style.transform = shift ? `translate3d(0, ${shift.toFixed(1)}px, 0)` : "";
        }
      }
      layers.forEach((l) => {
        const host = (l.closest("[data-parallax-host]") as HTMLElement) || l;
        const r = host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const progress = r.top + r.height / 2 - vh / 2; // 0 when the section is centred
        l.style.transform = `translate3d(0, ${(-progress * Number(l.dataset.depth)).toFixed(1)}px, 0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [root]);
}

export function LandingPage({
  onLogin,
  onRegister,
  dark,
  setDark,
}: {
  onLogin: () => void;
  onRegister: () => void;
  dark: boolean;
  setDark: (val: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  useParallax(page);
  const go = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="landing-page" ref={page}>
      <header className="landing-header">
        <a
          className="landing-brand"
          href="#home"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-mark">
            <Droplets />
          </span>
          <span>
            {STATION.shortName}
            <small>WATER REFILLING STATION</small>
          </span>
        </a>
        <button
          className="landing-menu"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={menuOpen ? "landing-nav open" : "landing-nav"}>
          <a href="#services" onClick={() => setMenuOpen(false)}>
            Services
          </a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#station" onClick={() => setMenuOpen(false)}>
            Visit us
          </a>
          <button
            className="icon-button theme-toggle"
            onClick={() => setDark(!dark)}
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
            style={{ color: "inherit", margin: "0 8px" }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn secondary" onClick={onLogin}>
            Sign in
          </button>
          <button className="btn primary" onClick={onRegister}>
            Order now <ArrowRight size={16} />
          </button>
        </nav>
      </header>
      <main>
        <section className="parallax-hero" id="home" data-parallax-host>
          {/* Background picture: fixed to the viewport but clipped to this hero, so it stays put while the page scrolls over it. */}
          <div
            className="px-layer px-photo"
            aria-hidden="true"
          >
            <img
              className="px-photo-img"
              src={HERO_IMAGE}
              alt=""
              loading="eager"
              decoding="async"
            />
          </div>
          <div
            className="px-layer px-sky"
            data-depth="0.05"
            aria-hidden="true"
          />
          <div
            className="px-layer px-bubbles"
            data-depth="0.18"
            aria-hidden="true"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <i
                key={i}
                style={{
                  left: `${(i * 83) % 100}%`,
                  top: `${(i * 37) % 80}%`,
                  width: 10 + ((i * 7) % 26),
                  height: 10 + ((i * 7) % 26),
                }}
              />
            ))}
          </div>
          <div
            className="px-layer px-wave px-wave-back"
            aria-hidden="true"
          >
            <svg viewBox="0 0 1440 220" preserveAspectRatio="none">
              <path d="M0 120 C 240 40, 480 200, 720 120 S 1200 40, 1440 120 V220 H0Z" />
            </svg>
          </div>
          <div
            className="px-layer px-wave px-wave-front"
            aria-hidden="true"
          >
            <svg viewBox="0 0 1440 220" preserveAspectRatio="none">
              <path d="M0 150 C 300 90, 540 210, 800 140 S 1250 80, 1440 150 V220 H0Z" />
            </svg>
          </div>
          <div className="px-content" data-depth="0.12">
            <div className="landing-kicker">
              <span className="landing-kicker-dot" /> CLEAN WATER, MADE SIMPLE
            </div>
            <h1>
              Fresh refills.
              <br />
              <em>Delivered to your door.</em>
            </h1>
            <p className="landing-lede">
              Order round and slim gallons from {STATION.shortName}, choose
              pickup or delivery, and follow your order every step of the way.
            </p>
            <div className="landing-hero-actions">
              <button className="btn primary large" onClick={onRegister}>
                Order water <ArrowRight size={17} />
              </button>
              <button
                className="btn secondary large"
                onClick={() => go("how-it-works")}
              >
                See how it works
              </button>
            </div>
            <div className="landing-trust">
              <span>
                <ShieldCheck size={16} /> Safe, private accounts
              </span>
              <span>
                <CheckCircle2 size={16} /> Live order updates
              </span>
              <span>
                <Truck size={16} /> Track your rider
              </span>
            </div>
          </div>
        </section>

        <section className="landing-benefits" id="services" data-parallax-host>
          <div
            className="px-layer px-blob px-blob-a"
            data-depth="0.12"
            aria-hidden="true"
          />
          <div className="landing-section-intro">
            <span className="eyebrow">OUR SERVICES</span>
            <h2>Everything you need for clean drinking water</h2>
            <p>
              From a quick refill to a monthly company account, we keep it
              simple.
            </p>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature">
              <span className="landing-feature-icon">
                <Droplets />
              </span>
              <h3>Gallon refills</h3>
              <p>
                Round and slim gallon refills, plus empty gallons, caps and
                seals when you need them.
              </p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon blue">
                <Truck />
              </span>
              <h3>Home delivery</h3>
              <p>
                We bring it to your door and you can watch your rider’s progress
                on a live map.
              </p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon violet">
                <CircleDollarSign />
              </span>
              <h3>Pay when you receive</h3>
              <p>
                Pay cash at pickup or on delivery. No online payment needed.
              </p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon amber">
                <Receipt />
              </span>
              <h3>Receipts and company billing</h3>
              <p>
                Printable receipts for every order, and one monthly statement
                for company accounts.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-how" id="how-it-works" data-parallax-host>
          <div className="landing-how-copy">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2>Three easy steps</h2>
            <p>
              Whether you prefer pickup or delivery, ordering takes about a
              minute.
            </p>
            <button className="btn primary" onClick={onRegister}>
              Create a free account <ArrowRight size={16} />
            </button>
          </div>
          <div className="landing-steps">
            <article>
              <span>01</span>
              <div>
                <h3>Add to your cart</h3>
                <p>Pick your gallons and supplies, then review your cart.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Choose pickup or delivery</h3>
                <p>
                  Tell us how you’d like to receive your order. We’ll confirm it
                  right away.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Receive and pay</h3>
                <p>
                  Follow your order, receive it, and pay in cash. Your receipt
                  is always available.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-cta" data-parallax-host>
          <div
            className="px-layer px-blob px-blob-b"
            data-depth="0.2"
            aria-hidden="true"
          />
          <PackageCheck size={34} />
          <h2>Ready for your first refill?</h2>
          <p>Create an account and place your order in minutes.</p>
          <button className="btn primary large" onClick={onRegister}>
            Order now <ArrowRight size={17} />
          </button>
        </section>

        <section className="landing-station" id="station">
          <div>
            <span className="eyebrow">VISIT US</span>
            <h2>{STATION.name}</h2>
            <p>{STATION.tagline}</p>
          </div>
          <ul>
            <li>
              <MapPin size={18} />
              <span>
                <strong>Address</strong>
                {STATION.address}
              </span>
            </li>
            <li>
              <Clock size={18} />
              <span>
                <strong>Hours</strong>
                {STATION.hours}
              </span>
            </li>
            <li>
              <Phone size={18} />
              <span>
                <strong>Call or text</strong>
                {STATION.phone}
              </span>
            </li>
            <li>
              <Mail size={18} />
              <span>
                <strong>Email</strong>
                {STATION.email}
              </span>
            </li>
          </ul>
          <button className="btn secondary" onClick={onLogin}>
            Station team sign in
          </button>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="landing-brand footer-brand" href="#home">
          <span className="brand-mark">
            <Droplets />
          </span>
          <span>
            {STATION.shortName}
            <small>WATER REFILLING STATION</small>
          </span>
        </a>
        <span>{STATION.tagline}</span>
        <span>
          © {new Date().getFullYear()} {STATION.shortName}
        </span>
      </footer>
    </div>
  );
}
