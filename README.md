# Mr. Wplace

![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)
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

**Android**

- **Edge Canary**: Install Edge Canary app and visit [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip) to auto-install
- **Firefox Nightly**: Install Firefox Nightly for Developers app and visit [Firefox Add-ons](https://addons.mozilla.org/ja/firefox/addon/mr-wplace) to install with one click

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

## ✨ Features

### 🖼️ Gallery & Image Management
- Upload, edit, and manage template images with thumbnails
- Layer-based image management with drag-and-drop reordering
- Image editing: brightness, contrast, saturation, sharpness, dithering
- Color conversion with multiple dithering algorithms (Bayer matrix)
- Import/export gallery as zip for backup and device migration
- Skirk Marble template JSON import support
- Progress tracking with remaining pixels and estimated completion time

### 🎨 Advanced Drawing Tools
- Draw images and texts on map tiles with overlay rendering
- 5 pixel fonts support (including custom Japanese fonts)
- Color palette with pixel count display
- Show/hide palette toggle for mobile-friendly painting
- 4 enhanced drawing modes: Giant Red Cross, Giant Red Cross (Bold), Giant Red Diamond, Giant Red Ring
- "Show Unplaced Only" mode: highlight unpainted pixels in gray
- "Color Isolate" mode: display only selected color automatically

### ⏱️ Time Travel
- Save and restore tile snapshots for rollback protection
- Share tiles with coordinates and timestamps
- Merge adjacent archived tiles into single image

### 🎨 Color Filter & Visual Aids
- Apply color filters aligned with WPlace's color palette
- Multiple drawing mode visualizations
- High contrast mode for better visibility
- Tile boundary display

### 📍 Bookmarks & Navigation
- Save favorite locations with tags (create, edit, filter by tags)
- Export/import bookmarks by tag
- Search locations by place name and jump to coordinates
- Convert between lat/lng and WPlace coordinates

### 🌓 Theme & Display
- Dark theme for map and UI
- High contrast mode
- GPU/CPU rendering mode switch for compatibility

### 💾 Data Saver Mode
- Offline tile cache with LRU (Least Recently Used) eviction
- Configurable cache size limit
- Storage usage monitoring
- Reduce bandwidth and improve performance

### 📊 Statistics & Analytics
- Paint statistics per user
- Color statistics per tile with breakdown by color
- Per-tile color statistics (matched/total)
- Aggregated statistics across multiple images

### 🔔 Notifications
- Get notified when paint accumulates (customizable threshold from 10% to 100%)
- Optional Google Calendar link integration
- Toggle notifications ON/OFF from popup

### 👥 Friends Book
- Save other players' information with tags
- Add notes for each player
- Import/export player list as CSV
- Hover to display player notes

### 🛠️ Developer Mode
- 10-click easter egg to enable dev mode (or Konami code)
- IndexedDB ↔ chrome.storage full sync feature
- Advanced tools for debugging and testing

## 📄 License

Mozilla Public License 2.0

## 🔗 Related Links

- [WPlace Official Site](https://wplace.jp/)
- [DaisyUI](https://daisyui.com/)
- [Wplace - Code of Conduct](https://wplace.live/terms/code-of-conduct)

---

**Made with ❤️ for the WPlace community**
