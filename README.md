# Mr. Wplace

![Version](https://img.shields.io/badge/version-1.11.2-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange.svg)
![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)

A powerful Chrome extension for WPlace site that provides advanced image drawing and management features on map tiles.

## 🚀 Installation

### For Users

#### Desktop

Get Mr. Wplace from the official stores:

- **Chrome Web Store**: [Install for Chrome](https://chromewebstore.google.com/detail/mr-wplace/klbcmpogekmdckegggoapdjjlehonnej)
- **Microsoft Edge Add-ons**: [Install for Edge](https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip)
- **Firefox Add-ons**: [Install for Firefox](https://addons.mozilla.org/ja/firefox/addon/mr-wplace/)

#### Mobile

**Android (Microsoft Edge Canary)**

1. Open Microsoft Edge Canary
2. Go to Settings → About Microsoft Edge
3. Tap the Edge build number (e.g., Edge Canary 125.0.2487.0) 5 times at the bottom to enable developer options
4. In developer options, tap "Extension install by id"
5. Enter extension ID: `acdodonamhbokadiikkfnnliplijigip`

**iOS (Orion Browser)**

1. Download [Orion Browser by Kagi](https://apps.apple.com/app/orion-browser-by-kagi/id1484498200) from App Store
2. Open Orion → Settings → Advanced → Enable "Chrome Extensions" and "Firefox Extensions"
3. Install the extension from [Chrome Web Store](https://chromewebstore.google.com/detail/mr-wplace/klbcmpogekmdckegggoapdjjlehonnej)

### For Developers

#### Prerequisites

- [Bun](https://bun.sh/) (JavaScript runtime & package manager)
- Git

#### Setup Development Environment

1. **Clone the repository**

   ```bash
   git clone git@github.com:C20-40A/mr-wplace.git
   cd mr-wplace
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Build the extension**

   ```bash
   bun run build
   ```

   This compiles `src/content.ts` → `dist/content.js`

4. **Load in Chrome**

   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the project root folder

5. **Start development mode** (optional)
   ```bash
   bun run dev
   ```
   This watches for file changes and auto-rebuilds the extension.

## 📦 Building for Production

### Version Management

Before building a release, update the version number using bump commands:

```bash
# Patch version (1.6.5 → 1.6.6) - for bug fixes
bun run bump:patch

# Minor version (1.6.5 → 1.7.0) - for new features
bun run bump:minor

# Major version (1.6.5 → 2.0.0) - for breaking changes
bun run bump:major
```

These commands automatically update version numbers in both `package.json` and `manifest.json`.

### Create Distribution Package

```bash
bun run build:release
```

This generates a `.zip` file (e.g., `mr-wplace-v1.6.5.zip`) ready for:

- Chrome Web Store submission
- Microsoft Edge Add-ons submission
- Manual distribution

## 🛠️ Available Commands

| Command                 | Description                                  |
| ----------------------- | -------------------------------------------- |
| `bun run build`         | Build extension for development              |
| `bun run dev`           | Build + watch mode (auto-rebuild on changes) |
| `bun run build:release` | Create production-ready zip package          |
| `bun run bump:patch`    | Bump patch version (x.x.X)                   |
| `bun run bump:minor`    | Bump minor version (x.X.0)                   |
| `bun run bump:major`    | Bump major version (X.0.0)                   |

## 🌟 Features

- **Gallery**: Upload, edit, and manage images
- **Drawing**: Draw images/texts on map tiles
- **Time Travel**: Save and restore tile snapshots
- **Color Filter**: Apply various color filters and drawing modes
- **Bookmarks**: Save favorite locations
- **Dark Theme**: Change map theme

## 📄 License

Mozilla Public License 2.0

## 🔗 Related Links

- [WPlace Official Site](https://wplace.jp/)
- [DaisyUI](https://daisyui.com/)
- [Wplace - Code of Conduct](https://wplace.live/terms/code-of-conduct)

---

**Made with ❤️ for the WPlace community**
