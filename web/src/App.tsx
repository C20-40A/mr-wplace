import { useEffect, useRef, useState } from 'react'
import heroImg from './assets/hero.png'
import PixelSnow from './components/PixelSnow'
import './App.css'

const FEATURES = [
  {
    icon: '🖼️',
    title: 'Image Overlay',
    desc: 'Place your own artwork directly onto the world map. Preview exactly how it looks before committing pixels.',
  },
  {
    icon: '🎨',
    title: 'Color Filter',
    desc: 'Highlight target colors on the canvas. Track placed vs. unplaced pixels at a glance with visual stats.',
  },
  {
    icon: '📸',
    title: 'Time Travel',
    desc: 'Snapshot tiles over time. Compare past and present states to see how the canvas has evolved.',
  },
  {
    icon: '📍',
    title: 'Area Manager',
    desc: 'Draw named regions on the map, set colors and labels, and manage collaborative zones with ease.',
  },
  {
    icon: '🗺️',
    title: 'Gallery',
    desc: 'Save reference images with map coordinates. Jump back to any spot instantly.',
  },
  {
    icon: '⚡',
    title: 'Live Stats',
    desc: 'Real-time progress bars per image. Know how complete your artwork is without counting by hand.',
  },
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className="feature-card"
      style={{ transitionDelay: `${delay}ms`, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)' }}
    >
      <span className="feature-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  )
}


export default function App() {
  const heroSection = useInView(0.05)
  const ctaSection = useInView(0.2)

  return (
    <>
      {/* Nav */}
      <nav className="nav">
        <span className="nav-brand">Mr. Wplace</span>
        <a
          className="nav-cta"
          href="https://chromewebstore.google.com/detail/mr-wplace/hkpnofjcfphdnmhndopcnaonmimfbpae"
          target="_blank"
          rel="noopener noreferrer"
        >
          Add to Chrome
        </a>
      </nav>

      {/* Hero */}
      <section className="hero-section">
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
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
        <div
          ref={heroSection.ref}
          className="hero-content"
          style={{ opacity: heroSection.visible ? 1 : 0, transform: heroSection.visible ? 'translateY(0)' : 'translateY(32px)' }}
        >
          <div className="hero-badge">Chrome / Edge Extension</div>
          <h1 className="hero-title">
            Draw smarter on<br />
            <span className="gradient-text">Wplace</span>
          </h1>
          <p className="hero-sub">
            Overlay images, track colors, manage areas, and travel through time —<br />
            all without leaving the map.
          </p>
          <div className="hero-actions">
            <a
              className="btn-primary"
              href="https://chromewebstore.google.com/detail/mr-wplace/hkpnofjcfphdnmhndopcnaonmimfbpae"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install Free
            </a>
            <a className="btn-ghost" href="#features">See Features</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-img-wrap">
            <img src={heroImg} alt="Mr. Wplace overlay illustration" className="hero-img" />
            <div className="hero-glow" />
          </div>
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

      {/* CTA */}
      <section className="cta-section">
        <div
          ref={ctaSection.ref}
          className="cta-box"
          style={{ opacity: ctaSection.visible ? 1 : 0, transform: ctaSection.visible ? 'scale(1)' : 'scale(0.96)' }}
        >
          <h2>Ready to start?</h2>
          <p>Free. No account needed. Works on Chrome &amp; Edge.</p>
          <a
            className="btn-primary"
            href="https://chromewebstore.google.com/detail/mr-wplace/hkpnofjcfphdnmhndopcnaonmimfbpae"
            target="_blank"
            rel="noopener noreferrer"
          >
            Add to Chrome — it&apos;s free
          </a>
        </div>
      </section>

      <footer className="footer">
        <span>© 2026 Mr. Wplace</span>
      </footer>
    </>
  )
}
