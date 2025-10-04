#!/bin/bash

set -e

echo "🚀 Building Mr. Wplace release package..."

# Get version from package.json
VERSION=$(node -pe "require('./package.json').version")
PACKAGE_NAME="mr-wplace-v${VERSION}"

# Build the extension
echo "📦 Building extension..."
bun run build

# Create release directory
echo "📁 Creating release directory..."
rm -rf release
mkdir -p release

# Copy required files
echo "📋 Copying files..."
cp manifest.json release/
cp popup.html release/
cp inject.js release/
cp service_worker.js release/
mkdir -p release/dist
cp dist/content.js release/dist/
cp dist/popup.js release/dist/
cp -r icons release/
cp -r _locales release/
cp -r public/* release/

# Create zip package
echo "🗜️ Creating zip package..."
cd release
zip -r "../${PACKAGE_NAME}.zip" .
cd ..

# Show results
echo "✅ Release package created successfully!"
echo "📦 Package: ${PACKAGE_NAME}.zip"
echo "📏 Size: $(ls -lh ${PACKAGE_NAME}.zip | awk '{print $5}')"
echo "📂 Files included:"
unzip -l "${PACKAGE_NAME}.zip" | tail -n +4 | head -n -2
