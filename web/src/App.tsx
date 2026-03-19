import { useEffect } from "react";
import PixelSnow from "./components/PixelSnow";
import chromeLogo from "./assets/chrome-logo.svg";
import firefoxLogo from "./assets/firefox0logo.svg";
import edgeLogo from "./assets/microsoft-edge-logo.svg";
import "./App.css";

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

const MOBILE_ITEMS = [
  {
    platform: "Android",
    icon: "🤖",
    items: [
      {
        browser: "Edge Canary",
        desc: "Install the Edge Canary app, then visit the Edge Add-ons page to install automatically.",
        href: "https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip",
      },
      {
        browser: "Firefox Nightly",
        desc: "Install the Firefox Nightly for Developers app, then visit the Firefox Add-ons page and install with one tap.",
        href: "https://addons.mozilla.org/ja/firefox/addon/mr-wplace",
      },
    ],
  },
  {
    platform: "iOS — Orion Browser",
    icon: "🍎",
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
            color="#aa3bff"
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
