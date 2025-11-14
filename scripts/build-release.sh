#!/bin/bash

set -e

echo "🚀 Building Mr. Wplace release packages..."

# Get version from package.json
VERSION=$(node -pe "require('./package.json').version")

# Build base extension
echo "📦 Building extension..."
bun run build

# Function to create browser-specific package
create_package() {
  local BROWSER=$1
  local PACKAGE_NAME="mr-wplace-v${VERSION}-${BROWSER}"

  echo ""
  echo "📦 Creating ${BROWSER} package..."

  # Create release directory
  echo "📁 Creating release directory..."
  rm -rf release-${BROWSER}
  mkdir -p release-${BROWSER}

  # Generate browser-specific manifest
  echo "📝 Generating ${BROWSER} manifest..."
  node ./scripts/generate-manifest.js ${BROWSER} release-${BROWSER}/manifest.json

  # Copy required files
  echo "📋 Copying files..."
  cp popup.html release-${BROWSER}/
  cp service_worker.js release-${BROWSER}/
  mkdir -p release-${BROWSER}/dist
  cp dist/content.js release-${BROWSER}/dist/
  cp dist/popup.js release-${BROWSER}/dist/
  cp dist/inject.js release-${BROWSER}/dist/
  cp -r icons release-${BROWSER}/
  cp -r _locales release-${BROWSER}/
  cp -r public/* release-${BROWSER}/

  # Create zip package
  echo "🗜️ Creating zip package..."
  cd release-${BROWSER}
  zip -r "../${PACKAGE_NAME}.zip" . > /dev/null
  cd ..

  echo "✅ ${BROWSER} package created: ${PACKAGE_NAME}.zip"
  echo "📏 Size: $(ls -lh ${PACKAGE_NAME}.zip | awk '{print $5}')"
}

# Create packages for both browsers
create_package "chrome"
create_package "firefox"

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf release-chrome release-firefox

echo ""
echo "✅ All release packages created successfully!"
echo "📦 Chrome: mr-wplace-v${VERSION}-chrome.zip"
echo "📦 Firefox: mr-wplace-v${VERSION}-firefox.zip"
