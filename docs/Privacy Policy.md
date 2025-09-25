# Privacy Policy for Mr. Wplace

**Last Updated: September 25, 2025**

## Overview

Mr. Wplace is a Chrome extension designed exclusively for use with WPlace (*.wplace.live) to provide creative support tools including image drawing, resource monitoring, bookmark management, and tile archiving. This privacy policy explains how we handle your data when you use our extension.

---

## Data Collection and Usage

### What Data We Collect

**Local Storage Only:**
- User-uploaded images (stored as base64 data)
- User preferences (language settings: Japanese/English)
- Drawing states (ON/OFF toggle states for placed images)
- Bookmark positions (manually saved map coordinates with custom names)
- Image metadata (timestamps, keys for organization)
- **Paint notification settings (threshold levels 10%-100%, alarm enable/disable state)**
- **Tile snapshots (saved map tile images for Time Travel feature)**

### What We DO NOT Collect

- Personal identifying information (names, emails, addresses)
- Location data (GPS coordinates, IP addresses)
- Web browsing history
- Financial or payment information
- Health information
- Authentication credentials
- Personal communications
- User activity tracking across websites

---

## How We Use Your Data

All data is stored locally on your device only using Chrome's storage API. We use this data to:

- **Image Management**: Store and organize your uploaded images for map drawing
- **User Preferences**: Remember your language setting and drawing preferences
- **Bookmark Function**: Save map positions you manually bookmark with custom names
- **Drawing State**: Maintain ON/OFF states of placed images across browser sessions
- **Paint Notification**: Monitor WPlace paint resources and create local alarms to notify you when reaching your configured threshold
- **Tile Archiving**: Save map tile snapshots for Time Travel feature to restore past states

---

## Data Storage and Security

- **Local Storage**: All data is stored locally on your device using Chrome's secure storage system
- **No External Transmission**: We never send your data to external servers or third parties
- **No Cloud Storage**: We do not use any cloud storage services
- **Device-Only Access**: Only you have access to your data on your device

---

## Permissions Explanation

### Required Permissions

**storage & unlimitedStorage:**
- Purpose: Store image data, tile snapshots, user preferences, and bookmarks locally
- Scope: Limited to extension-related data only

**activeTab:**
- Purpose: Access WPlace website to provide drawing functionality and monitor paint status
- Scope: Only active WPlace tabs when extension is used

**alarms:**
- Purpose: Schedule paint accumulation notifications based on user-configured thresholds
- Scope: Local alarms only, no external services

**notifications:**
- Purpose: Display paint alerts when reaching configured threshold
- Scope: Browser notifications only, no push notification services

**Host Permissions (*.wplace.live):**
- Purpose: Enable image drawing, paint monitoring, and tile archiving on WPlace maps only
- Scope: Exclusively WPlace website, no access to other sites

---

## Third-Party Data Sharing

### We DO NOT:

- Sell your data to any third parties
- Share your data with advertisers
- Transfer your data to external services
- Use your data for purposes unrelated to the extension's core functionality
- Access or transmit your data outside your local device

---

## Data Retention and Deletion

- **User Control**: You can delete all extension data by removing the extension or clearing Chrome extension data
- **Automatic Deletion**: Data is automatically removed when you uninstall the extension
- **No External Copies**: Since we don't transmit data externally, no copies exist outside your device

---

## Website Scope

This extension only functions on:
- WPlace website (*.wplace.live)
- No other websites are accessed or affected

---

## Children's Privacy

This extension does not knowingly collect data from children under 13. The extension's functionality is designed for general creative use on WPlace maps.

---

## Changes to This Policy

We may update this privacy policy as the extension evolves. Any changes will be reflected in the "Last Updated" date above. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General privacy best practices for browser extensions
- Local-only data storage principles

---

## Technical Details

- **Data Format**: Images stored as base64, settings as JSON, tile snapshots as image data
- **Storage Location**: Chrome's local extension storage
- **Encryption**: Uses Chrome's built-in storage security
- **Access Control**: Only this extension can access its stored data
- **Notification System**: Local alarms only, no external notification services

---

## Contact

For questions about this privacy policy or data handling:
- GitHub: https://github.com/[username]/wplace-studio
- Open an issue for privacy-related concerns

---

## Open Source Transparency

This extension is open-source (MPL-2.0 license) for complete transparency. You can review the source code to verify our data handling practices.
