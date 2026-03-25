import { useEffect } from "react";
import PixelSnow from "./components/PixelSnow";
import CircularGallery from "./components/CircularGallery";
import misterIcon from "./assets/mister-icon.png";
import bgImg from "./assets/bg-img.webp";
import chromeLogo from "./assets/chrome-logo.svg";
import firefoxLogo from "./assets/firefox0logo.svg";
import edgeLogo from "./assets/microsoft-edge-logo.svg";
import androidLogo from "./assets/android-logo.svg";
import iosLogo from "./assets/ios-logo.svg";
import sc3d from "./assets/showcase/sc3d.webp";
import sctext from "./assets/showcase/sctext.webp";
import sc_tile_dl from "./assets/showcase/sc_tile_dl.webp";
import sc_charge from "./assets/showcase/sc_charge.webp";
import sc_color_filter from "./assets/showcase/sc_color_filter.webp";
import sc_image_overlay from "./assets/showcase/sc_image_overlay.webp";
import sc_more_filters from "./assets/showcase/sc_more_filters.webp";
import sc_image_gallery from "./assets/showcase/sc_image_gallery.webp";
import sc_mini_pallete from "./assets/showcase/sc_mini_pallete.webp";

const WPLACE_URL = "https://wplace.live/";
const MESSAGES = {
  en: {
    navOpenWplace: "Open Wplace",
    installFor: (name: string) => `Install for ${name}`,
    heroBadge: "Browser Extension",
    heroTagline: "Draw smarter on Wplace.",
    heroOpen: "Open Wplace",
    heroShowcase: "See Showcase ↓",
    showcaseTitle: "Showcase",
    showcaseDescription: "See Mr. Wplace in action.",
    mobileTitle: "Mobile Support",
    mobileDescription: "Bring Mr. Wplace to Android & iOS.",
    ctaTitle: "Ready to start?",
    ctaDescription: "Free. No account needed. Works on Chrome, Firefox & Edge.",
    mobileAndroidFirefox:
      "Install the Firefox Nightly for Developers app, then visit the Firefox Add-ons page and install with one tap.",
    mobileAndroidEdge:
      "Install the Edge Canary app, then visit the Edge Add-ons page to install automatically.",
    mobileIosOrion:
      'Download Orion from the App Store → Settings → Advanced → Enable "Chrome Extensions" → Install from Chrome Web Store.',
    showcaseItems: [
      "Image Overlay",
      "Text Draw Controls",
      "3D View",
      "Tile Downloader",
      "Image Gallery",
      "Charge Status",
      "Color Filter",
      "More Filters",
      "Minimize Palette",
    ],
  },
  ja: {
    navOpenWplace: "Wplace を開く",
    installFor: (name: string) => `${name} に追加`,
    heroBadge: "ブラウザ拡張機能",
    heroTagline: "Wplaceに別次元の快適さを",
    heroOpen: "Wplace を開く",
    heroShowcase: "Showcase ↓",
    showcaseTitle: "Showcase",
    showcaseDescription: "横にスワイプして搭載された機能をご覧ください",
    mobileTitle: "スマホ対応",
    mobileDescription: "Android と iOS でも Mr. Wplace を使えます",
    ctaTitle: "はじめましょう",
    ctaDescription:
      "完全無料。アカウント不要。Chrome / Firefox / Edge ですぐ使えます。",
    mobileAndroidFirefox:
      "Firefox Nightly for Developers を入れて、Firefox Add-ons ページからワンタップでインストールします。",
    mobileAndroidEdge:
      "Edge Canary を入れて、Edge Add-ons ページから自動インストールします。",
    mobileIosOrion:
      'App Store から Orion を入れて、Settings → Advanced → "Chrome Extensions" を有効化 → Chrome Web Store からインストールします。',
    showcaseItems: [
      "画像オーバーレイ",
      "文字描画",
      "3Dビュー",
      "タイル保存",
      "画像ギャラリー",
      "チャージ確認",
      "カラーフィルター",
      "追加フィルター",
      "パレット最小化",
    ],
  },
} as const;

type MessageMap = (typeof MESSAGES)["en"];
type MessageTextKey = {
  [K in keyof MessageMap]: MessageMap[K] extends string ? K : never;
}[keyof MessageMap];

const GlobeIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"
      stroke="currentColor"
      strokeWidth="1.35"
    />
  </svg>
);

// Add or replace screenshots here.
// Keep each item minimal: image + text.
const SHOWCASE_ITEMS = [
  { image: sc_image_overlay },
  { image: sctext },
  { image: sc3d },
  { image: sc_tile_dl },
  { image: sc_image_gallery },
  { image: sc_charge },
  { image: sc_color_filter },
  { image: sc_more_filters },
  { image: sc_mini_pallete },
];

interface BrowserEntry {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const getBrowserEntries = (locale: "ja" | "en"): BrowserEntry[] => [
  {
    name: "Chrome",
    href: `https://chromewebstore.google.com/detail/mr-wplace/klbcmpogekmdckegggoapdjjlehonnej${
      locale === "ja" ? "?hl=ja" : ""
    }`,
    icon: <img src={chromeLogo} width="20" height="20" alt="Chrome" />,
  },
  {
    name: "Firefox",
    href:
      locale === "ja"
        ? "https://addons.mozilla.org/ja/firefox/addon/mr-wplace/"
        : "https://addons.mozilla.org/firefox/addon/mr-wplace/",
    icon: <img src={firefoxLogo} width="20" height="20" alt="Firefox" />,
  },
  {
    name: "Edge",
    href: "https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip",
    icon: <img src={edgeLogo} width="20" height="20" alt="Edge" />,
  },
];

interface MobilePlatform {
  platform: string;
  icon: React.ReactNode;
  items: {
    browser: string;
    descKey: MessageTextKey;
    href: string;
  }[];
}

const MOBILE_ITEMS: MobilePlatform[] = [
  {
    platform: "Android",
    icon: <img src={androidLogo} width="20" height="20" alt="Android" />,
    items: [
      {
        browser: "Firefox Nightly",
        descKey: "mobileAndroidFirefox",
        href: "https://play.google.com/store/apps/details?id=org.mozilla.fenix",
      },
      {
        browser: "Edge Canary",
        descKey: "mobileAndroidEdge",
        href: "https://play.google.com/store/apps/details?id=com.microsoft.emmx.canary",
      },
    ],
  },
  {
    platform: "iOS — Orion Browser",
    icon: <img src={iosLogo} width="20" height="20" alt="iOS" />,
    items: [
      {
        browser: "Orion Browser by Kagi",
        descKey: "mobileIosOrion",
        href: "https://apps.apple.com/us/app/orion-browser-by-kagi/id1484498200",
      },
    ],
  },
];

export default function App() {
  const locale = document.documentElement.lang.startsWith("ja") ? "ja" : "en";
  const t = MESSAGES[locale];
  const browsers = getBrowserEntries(locale);
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
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 h-14 gap-4 border-b border-border backdrop-blur-md [background:color-mix(in_srgb,var(--background)_80%,transparent)] sm:px-4">
        <span className="font-semibold text-base text-foreground tracking-[-0.3px] shrink-0">
          Mr. Wplace
        </span>
        <div className="flex items-center gap-2">
          <a
            href={WPLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t.navOpenWplace}
            className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-foreground no-underline transition-[background,border-color] duration-200 hover:[background:var(--brand-bg)] hover:border-(--brand-border)"
          >
            <GlobeIcon />
          </a>
          {browsers.map((b) => (
            <a
              key={b.name}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              title={t.installFor(b.name)}
              className="inline-flex items-center p-1.5 rounded-lg border border-border text-foreground no-underline transition-[background,border-color] duration-200 hover:[background:var(--brand-bg)] hover:border-(--brand-border)"
            >
              {b.icon}
            </a>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-wrap items-center justify-center gap-12 px-8 py-20 pb-24 overflow-hidden min-h-[calc(100svh-56px)] sm:px-4 sm:py-12 sm:pb-16 sm:gap-8">
        <div
          className="absolute inset-0 z-0 pointer-events-none bg-center bg-cover bg-no-repeat opacity-30 blur-[1.5px] scale-[1.02]"
          style={{ backgroundImage: `url(${bgImg})` }}
        />
        <div className="absolute inset-0 z-0 pointer-events-none">
          <PixelSnow
            color="#ffffff"
            flakeSize={0.03}
            minFlakeSize={1.25}
            pixelResolution={220}
            speed={1}
            density={0.16}
            direction={80}
            brightness={0.55}
            depthFade={8}
            farPlane={16}
            gamma={0.4545}
            variant="square"
          />
        </div>
        <div className="reveal flex-[1_1_340px] max-w-135 transition-[opacity,transform] duration-700 ease-out">
          <div className="mb-4 flex justify-end">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.4px] uppercase text-(--brand) [background:var(--brand-bg)] border border-(--brand-border) rounded-full px-3 py-1">
              {t.heroBadge}
            </div>
          </div>
          <div className="mb-4">
            <div className="flex items-center gap-4 max-sm:gap-2.5">
              <img
                src={misterIcon}
                alt="Mr. Wplace"
                width={256}
                height={256}
                className="w-24 h-24 max-sm:w-14 max-sm:h-14 [image-rendering:pixelated] drop-shadow-[0_0_20px_rgba(134,59,255,0.3)] shrink-0"
              />
              <div>
                <h1 className="text-[clamp(36px,5.5vw,60px)] font-bold tracking-[-1.5px] leading-[1.08] text-foreground m-0">
                  Mr. Wplace
                </h1>
                <p className="text-[clamp(17px,2.5vw,22px)] font-medium tracking-[-0.3px] text-muted-foreground m-0 leading-snug">
                  {t.heroTagline}
                </p>
              </div>
            </div>
          </div>
          <div className="mb-5 flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2">
              {browsers.map((b) => (
                <a
                  key={b.name}
                  href={b.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-border [background:color-mix(in_srgb,var(--muted)_60%,transparent)] text-foreground font-medium text-[13px] no-underline transition-[background,border-color,transform] duration-200 hover:[background:var(--brand-bg)] hover:border-(--brand-border) hover:-translate-y-px"
                >
                  {b.icon}
                  <span>{t.installFor(b.name)}</span>
                </a>
              ))}
            </div>
            <a
              href={WPLACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-[9px] border border-border [background:color-mix(in_srgb,var(--muted)_45%,transparent)] text-muted-foreground font-medium text-[12px] no-underline transition-[background,border-color,color,transform] duration-200 hover:[background:var(--brand-bg)] hover:border-(--brand-border) hover:text-foreground hover:-translate-y-px"
            >
              <GlobeIcon />
              <span>{t.heroOpen}</span>
            </a>
          </div>
          <a
            href="#showcase"
            className="text-[13px] text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground"
          >
            {t.heroShowcase}
          </a>
        </div>
      </section>

      {/* Showcase */}
      <section
        id="showcase"
        className="px-8 py-20 border-t border-border sm:px-4 sm:py-14"
      >
        <div className="max-w-240 mx-auto">
          <div className="text-center">
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold tracking-[-1px] text-foreground m-0 mb-3">
              {t.showcaseTitle}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t.showcaseDescription}
            </p>
          </div>
          <div className="reveal relative h-140 overflow-hidden sm:h-105">
            <CircularGallery
              items={SHOWCASE_ITEMS.map((item, index) => ({
                ...item,
                text: t.showcaseItems[index],
              }))}
              bend={1}
              textColor="#ffffff"
              borderRadius={0.04}
              scrollSpeed={2}
              scrollEase={0.05}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r from-background to-transparent max-sm:w-8" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-background to-transparent max-sm:w-8" />
          </div>
        </div>
      </section>

      {/* Mobile */}
      <section
        id="mobile"
        className="px-8 py-20 border-t border-border sm:px-4 sm:py-14"
      >
        <div className="reveal max-w-240 mx-auto transition-[opacity,transform] duration-600 ease-out">
          <div className="text-center mb-14">
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold tracking-[-1px] text-foreground m-0 mb-3">
              {t.mobileTitle}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t.mobileDescription}
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5 sm:grid-cols-[1fr]">
            {MOBILE_ITEMS.map((platform) => (
              <div
                key={platform.platform}
                className="p-7 px-6 border border-border rounded-2xl [background:color-mix(in_srgb,var(--muted)_50%,transparent)]"
              >
                <div className="flex items-center gap-2.5 text-[17px] font-semibold text-foreground mb-4.5">
                  <span>{platform.icon}</span>
                  <span>{platform.platform}</span>
                </div>
                <ul className="list-none p-0 m-0 flex flex-col gap-3.5">
                  {platform.items.map((item) => (
                    <li key={item.browser} className="flex flex-col gap-1">
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-(--brand) no-underline hover:underline"
                      >
                        {item.browser}
                      </a>
                      <span className="text-[13px] text-muted-foreground leading-[1.55]">
                        {t[item.descKey]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-20 border-t border-border flex justify-center sm:px-4 sm:py-14">
        <div className="reveal w-full max-w-150 text-center px-10 py-14 border border-(--brand-border) rounded-3xl [background:var(--brand-bg)] transition-[opacity,transform] duration-600 ease-out sm:px-5 sm:py-9">
          <h2 className="text-[36px] font-bold tracking-[-0.8px] text-foreground m-0 mb-3">
            {t.ctaTitle}
          </h2>
          <p className="text-base text-muted-foreground mb-8">
            {t.ctaDescription}
          </p>
          <div className="flex gap-2.5 flex-wrap justify-center">
            {browsers.map((b) => (
              <a
                key={b.name}
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] border border-border [background:color-mix(in_srgb,var(--muted)_60%,transparent)] text-foreground font-medium text-sm no-underline transition-[background,border-color,transform] duration-200 hover:[background:var(--brand-bg)] hover:border-(--brand-border) hover:-translate-y-px"
              >
                {b.icon}
                <span>{t.installFor(b.name)}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-8 py-6 border-t border-border text-center text-[13px] text-muted-foreground">
        <span>© 2026 C20</span>
      </footer>
    </>
  );
}
