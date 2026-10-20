import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Droplets,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Truck,
  Waves,
  X,
} from "lucide-react";

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
  return (
    <div className="landing-page">
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
            AquaWell<small>WATER REFILLING STATION</small>
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
          <a href="#about" onClick={() => setMenuOpen(false)}>
            About AquaWell
          </a>
          <button
            className="icon-button theme-toggle"
            onClick={() => setDark(!dark)}
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
            style={{ color: "inherit", margin: "0 8px" }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn secondary" onClick={onLogin}>
            Sign in
          </button>
          <button className="btn primary" onClick={onRegister}>
            Get started <ArrowRight size={16} />
          </button>
        </nav>
      </header>
      <main>
        <section className="landing-hero" id="home">
          <div className="landing-hero-copy">
            <div className="landing-kicker">
              <span className="landing-kicker-dot" /> CLEAN WATER, MADE SIMPLE
            </div>
            <h1>
              Everyday hydration.
              <br />
              <em>Handled with care.</em>
            </h1>
            <p className="landing-lede">
              AquaWell makes ordering water simpler, while keeping every order,
              payment, and delivery organized from station to doorstep.
            </p>
            <div className="landing-hero-actions">
              <button className="btn primary large" onClick={onRegister}>
                Order water <ArrowRight size={17} />
              </button>
              <button
                className="btn secondary large"
                onClick={() =>
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                See how it works
              </button>
            </div>
            <div className="landing-trust">
              <span>
                <ShieldCheck size={16} /> Account-based access
              </span>
              <span>
                <CheckCircle2 size={16} /> Clear order updates
              </span>
            </div>
          </div>
          <div
            className="landing-hero-art"
            aria-label="AquaWell clean water illustration"
          >
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-glass">
              <div className="hero-waterline" />
              <div className="hero-water">
                <Waves size={68} />
              </div>
            </div>
            <div className="hero-floating hero-floating-top">
              <span>
                <Droplets size={17} />
              </span>
              <div>
                <strong>Fresh start</strong>
                <small>Water when you need it</small>
              </div>
            </div>
            <div className="hero-floating hero-floating-bottom">
              <span>
                <Truck size={18} />
              </span>
              <div>
                <strong>Order to doorstep</strong>
                <small>Track your delivery</small>
              </div>
            </div>
            <div className="hero-sparkle sparkle-a">✦</div>
            <div className="hero-sparkle sparkle-b">✧</div>
          </div>
        </section>
        <section className="landing-benefits" id="services">
          <div className="landing-section-intro">
            <span className="eyebrow">A BETTER WAY TO ORDER</span>
            <h2>
              Simple for customers.
              <br />
              Organized behind the scenes.
            </h2>
            <p>
              One connected service for placing orders and keeping station
              operations clear.
            </p>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature">
              <span className="landing-feature-icon">
                <Droplets />
              </span>
              <h3>Order water with ease</h3>
              <p>
                Browse available products, choose your quantities, and submit
                your order in a few steps.
              </p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon blue">
                <ClipboardList />
              </span>
              <h3>Know what happens next</h3>
              <p>
                Follow your order status and see whether it is being prepared,
                is ready for pickup, or is out for delivery.
              </p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon violet">
                <CircleDollarSign />
              </span>
              <h3>Clear payment handling</h3>
              <p>
                Pickup and cash-on-delivery options are supported, with payment
                recorded after collection is verified.
              </p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon amber">
                <ShieldCheck />
              </span>
              <h3>Protected account access</h3>
              <p>
                Customer and station workspaces are separated by verified
                account roles and permissions.
              </p>
            </article>
          </div>
        </section>
        <section className="landing-how" id="how-it-works">
          <div className="landing-how-copy">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2>
              From your order
              <br />
              to a smoother handoff.
            </h2>
            <p>
              Whether you prefer pickup or delivery, each step is designed to be
              easy to follow.
            </p>
            <button className="btn primary" onClick={onRegister}>
              Create a customer account <ArrowRight size={16} />
            </button>
          </div>
          <div className="landing-steps">
            <article>
              <span>01</span>
              <div>
                <h3>Create your account</h3>
                <p>
                  Sign in securely to place orders and view your order history.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Choose pickup or delivery</h3>
                <p>
                  Select your preferred fulfillment option and review your order
                  before submitting.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Follow your order</h3>
                <p>
                  Station staff confirms stock availability and updates progress
                  as your order moves forward.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="landing-about" id="about">
          <div className="landing-about-mark">
            <Droplets size={34} />
          </div>
          <div>
            <span className="eyebrow">ABOUT AQUAWELL</span>
            <h2>Clean water service, supported by clear operations.</h2>
            <p>
              AquaWell is designed to connect customers with the station while
              helping staff coordinate inventory, orders, payments, and
              deliveries in one place. The goal is a more dependable experience
              at every step.
            </p>
          </div>
          <div className="landing-about-action">
            <button className="btn secondary" onClick={onLogin}>
              Station team sign in
            </button>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="landing-brand footer-brand" href="#home">
          <span className="brand-mark">
            <Droplets />
          </span>
          <span>
            AquaWell<small>WATER REFILLING STATION</small>
          </span>
        </a>
        <span>Clean water. Clear operations.</span>
        <span>© {new Date().getFullYear()} AquaWell</span>
      </footer>
    </div>
  );
}
