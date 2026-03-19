import { useEffect } from "react";
import PixelSnow from "./components/PixelSnow";
import chromeLogo from "./assets/chrome-logo.svg";
import firefoxLogo from "./assets/firefox0logo.svg";
import edgeLogo from "./assets/microsoft-edge-logo.svg";
import androidLogo from "./assets/android-logo.svg";
import iosLogo from "./assets/ios-logo.svg";

const APP_STYLES = `
/* ── Reset / Base ── */
* { box-sizing: border-box; }

/* ── Nav ── */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  height: 56px;
  background: color-mix(in srgb, var(--background) 80%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  gap: 16px;
}
.nav-brand {
  font-weight: 600;
  font-size: 16px;
  color: var(--foreground);
  letter-spacing: -0.3px;
  flex-shrink: 0;
}
.nav-browsers {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-browser-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s;
}
.nav-browser-link:hover {
  background: var(--brand-bg);
  border-color: var(--brand-border);
}

/* ── Hero ── */
.hero-section {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 48px;
  padding: 80px 32px 96px;
  overflow: hidden;
  min-height: calc(100svh - 56px);
}

.hero-content {
  flex: 1 1 340px;
  max-width: 600px;
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.hero-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--brand);
  background: var(--brand-bg);
  border: 1px solid var(--brand-border);
  border-radius: 100px;
  padding: 4px 12px;
  margin-bottom: 20px;
}
.hero-title {
  font-size: clamp(40px, 6vw, 68px);
  font-weight: 700;
  letter-spacing: -2px;
  line-height: 1.05;
  color: var(--foreground);
  margin: 0 0 20px;
}
.gradient-text {
  background: linear-gradient(135deg, var(--foreground), var(--muted-foreground));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-sub {
  font-size: 18px;
  line-height: 1.6;
  color: var(--muted-foreground);
  margin-bottom: 36px;
}
.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.hero-see-features {
  font-size: 14px;
  color: var(--muted-foreground);
  text-decoration: none;
  transition: color 0.2s;
}
.hero-see-features:hover { color: var(--foreground); }

/* ── Browser Buttons ── */
.btn-browser {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--muted) 60%, transparent);
  color: var(--foreground);
  font-weight: 500;
  font-size: 14px;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}
.btn-browser:hover {
  background: var(--brand-bg);
  border-color: var(--brand-border);
  transform: translateY(-1px);
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 10px;
  background: var(--brand);
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.2s;
}
.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 12px 24px;
  border-radius: 10px;
  border: 1px solid var(--border);
  color: var(--foreground);
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s;
}
.btn-ghost:hover { background: var(--brand-bg); }

/* ── Features ── */
.features-section {
  padding: 80px 32px;
  border-top: 1px solid var(--border);
}
.section-header {
  text-align: center;
  margin-bottom: 56px;
}
.section-header h2 {
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--foreground);
  margin: 0 0 12px;
}
.section-header p {
  font-size: 18px;
  color: var(--muted-foreground);
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
  max-width: 960px;
  margin: 0 auto;
}
.feature-card {
  padding: 28px 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--muted) 50%, transparent);
  transition: opacity 0.5s ease, transform 0.5s ease, box-shadow 0.25s;
  text-align: left;
}
.feature-card:hover {
  box-shadow: var(--shadow);
  border-color: var(--brand-border);
}
.feature-icon {
  font-size: 28px;
  display: block;
  margin-bottom: 14px;
}
.feature-card h3 {
  font-size: 17px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 8px;
}
.feature-card p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted-foreground);
}

/* ── Mobile ── */
.mobile-section {
  padding: 80px 32px;
  border-top: 1px solid var(--border);
}
.mobile-inner {
  max-width: 960px;
  margin: 0 auto;
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.mobile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}
.mobile-platform-card {
  padding: 28px 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--muted) 50%, transparent);
}
.mobile-platform-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 18px;
}
.mobile-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mobile-steps li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mobile-browser-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--brand);
  text-decoration: none;
}
.mobile-browser-name:hover { text-decoration: underline; }
.mobile-step-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.55;
}

/* ── CTA ── */
.cta-section {
  padding: 80px 32px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
}
.cta-box {
  max-width: 600px;
  width: 100%;
  text-align: center;
  padding: 56px 40px;
  border: 1px solid var(--brand-border);
  border-radius: 24px;
  background: var(--brand-bg);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.cta-box h2 {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.8px;
  color: var(--foreground);
  margin: 0 0 12px;
}
.cta-box p {
  font-size: 16px;
  color: var(--muted-foreground);
  margin-bottom: 32px;
}
.cta-browsers {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

/* ── Footer ── */
.footer {
  padding: 24px 32px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 13px;
  color: var(--muted-foreground);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .nav { padding: 0 16px; }
  .nav-browser-name { display: none; }
  .nav-browser-link { padding: 5px 8px; }
  .hero-section { padding: 48px 16px 64px; gap: 32px; }
  .hero-sub br { display: none; }
  .features-section, .cta-section, .mobile-section { padding: 56px 16px; }
  .cta-box { padding: 36px 20px; }
  .mobile-grid { grid-template-columns: 1fr; }
}
`;

const FEATURES = [
  {
    icon: "🖼️",
    title: "Image Overlay",
    desc: "Place your own artwork directly onto the world map. Preview exactly how it looks before committing pixels.",
  },
  {
    icon: "🎨",
    title: "Color Filter",
    desc: "Highlight target colors on the canvas. Track placed vs. unplaced pixels at a glance with visual stats.",
  },
  {
    icon: "📸",
    title: "Time Travel",
    desc: "Snapshot tiles over time. Compare past and present states to see how the canvas has evolved.",
  },
  {
    icon: "📍",
    title: "Area Manager",
    desc: "Draw named regions on the map, set colors and labels, and manage collaborative zones with ease.",
  },
  {
    icon: "🗺️",
    title: "Gallery",
    desc: "Save reference images with map coordinates. Jump back to any spot instantly.",
  },
  {
    icon: "⚡",
    title: "Live Stats",
    desc: "Real-time progress bars per image. Know how complete your artwork is without counting by hand.",
  },
];

const BROWSERS = [
  {
    name: "Chrome",
    href: "https://chromewebstore.google.com/detail/mr-wplace/klbcmpogekmdckegggoapdjjlehonnej",
    icon: <img src={chromeLogo} width="20" height="20" alt="Chrome" />,
  },
  {
    name: "Firefox",
    href: "https://addons.mozilla.org/ja/firefox/addon/mr-wplace/",
    icon: <img src={firefoxLogo} width="20" height="20" alt="Firefox" />,
  },
  {
    name: "Edge",
    href: "https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip",
    icon: <img src={edgeLogo} width="20" height="20" alt="Edge" />,
  },
];

const MOBILE_ITEMS: {
  platform: string;
  icon: React.ReactNode;
  items: { browser: string; desc: string; href: string }[];
}[] = [
  {
    platform: "Android",
    icon: <img src={androidLogo} width="20" height="20" alt="Android" />,
    items: [
      {
        browser: "Firefox Nightly",
        desc: "Install the Firefox Nightly for Developers app, then visit the Firefox Add-ons page and install with one tap.",
        href: "https://addons.mozilla.org/ja/firefox/addon/mr-wplace",
      },
      {
        browser: "Edge Canary",
        desc: "Install the Edge Canary app, then visit the Edge Add-ons page to install automatically.",
        href: "https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip",
      },
    ],
  },
  {
    platform: "iOS — Orion Browser",
    icon: <img src={iosLogo} width="20" height="20" alt="iOS" />,
    items: [
      {
        browser: "Orion Browser by Kagi",
        desc: 'Download Orion from the App Store → Settings → Advanced → Enable "Chrome Extensions" → Install from Chrome Web Store.',
        href: "https://chromewebstore.google.com/detail/mr-wplace/klbcmpogekmdckegggoapdjjlehonnej",
      },
    ],
  },
];

function FeatureCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: string;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <div
      className="feature-card reveal"
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      <span className="feature-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{APP_STYLES}</style>

      {/* Nav */}
      <nav className="nav">
        <span className="nav-brand">Mr. Wplace</span>
        <div className="nav-browsers">
          {BROWSERS.map((b) => (
            <a
              key={b.name}
              className="nav-browser-link"
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Install for ${b.name}`}
            >
              {b.icon}
              <span className="nav-browser-name">{b.name}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-section">
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          <PixelSnow
            color="#ffffff"
            flakeSize={0.03}
            minFlakeSize={1.25}
            pixelResolution={220}
            speed={1}
            density={0.25}
            direction={80}
            brightness={1}
            depthFade={8}
            farPlane={16}
            gamma={0.4545}
            variant="square"
          />
        </div>
        <div className="hero-content reveal">
          <div className="hero-badge">Chrome / Firefox / Edge Extension</div>
          <h1 className="hero-title">
            Draw smarter on
            <br />
            <span className="gradient-text">Wplace</span>
          </h1>
          <p className="hero-sub">
            Overlay images, track colors, manage areas, and travel through time
            —<br />
            all without leaving the map.
          </p>
          <div className="hero-actions">
            {BROWSERS.map((b) => (
              <a
                key={b.name}
                className="btn-browser"
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {b.icon}
                <span>Add to {b.name}</span>
              </a>
            ))}
          </div>
          <a className="hero-see-features" href="#features">
            See Features ↓
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2>Everything you need</h2>
          <p>A full toolkit built for Wplace collaborators.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 70} />
          ))}
        </div>
      </section>

      {/* Mobile */}
      <section id="mobile" className="mobile-section">
        <div className="mobile-inner reveal">
          <div className="section-header">
            <h2>Mobile Support</h2>
            <p>Use Mr. Wplace on your phone too.</p>
          </div>
          <div className="mobile-grid">
            {MOBILE_ITEMS.map((platform) => (
              <div key={platform.platform} className="mobile-platform-card">
                <div className="mobile-platform-title">
                  <span>{platform.icon}</span>
                  <span>{platform.platform}</span>
                </div>
                <ul className="mobile-steps">
                  {platform.items.map((item) => (
                    <li key={item.browser}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mobile-browser-name"
                      >
                        {item.browser}
                      </a>
                      <span className="mobile-step-desc">{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-box reveal">
          <h2>Ready to start?</h2>
          <p>Free. No account needed. Works on Chrome, Firefox &amp; Edge.</p>
          <div className="cta-browsers">
            {BROWSERS.map((b) => (
              <a
                key={b.name}
                className="btn-browser"
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {b.icon}
                <span>Add to {b.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>© 2026 Mr. Wplace</span>
      </footer>
    </>
  );
}
