#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Version bump types
const BUMP_TYPES = ['major', 'minor', 'patch'];

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid version format: ${version}`);
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function bumpVersion(currentVersion, bumpType) {
  let [major, minor, patch] = parseVersion(currentVersion);
  
  switch (bumpType) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
      patch++;
      break;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
  
  return `${major}.${minor}.${patch}`;
}

function updateJsonVersion(filePath, newVersion) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`✅ Updated ${path.basename(filePath)}: ${newVersion}`);
}

function updateReadmeVersion(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /version-\d+\.\d+\.\d+-blue\.svg/g,
    `version-${newVersion}-blue.svg`
  );
  fs.writeFileSync(filePath, updated);
  console.log(`✅ Updated ${path.basename(filePath)}: ${newVersion}`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 1 || !BUMP_TYPES.includes(args[0])) {
    console.log('Usage: node bump-version.js <major|minor|patch>');
    console.log('Example: node bump-version.js patch');
    process.exit(1);
  }
  
  const bumpType = args[0];
  const rootDir = path.resolve(__dirname, '..');
  
  // Read current version from package.json
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  
  console.log(`📦 Current version: ${currentVersion}`);
  
  // Calculate new version
  const newVersion = bumpVersion(currentVersion, bumpType);
  console.log(`🚀 New version: ${newVersion}`);
  
  // Update files
  updateJsonVersion(packageJsonPath, newVersion);
  updateJsonVersion(path.join(rootDir, 'manifest.json'), newVersion);
  updateJsonVersion(path.join(rootDir, 'manifest.template.json'), newVersion);
  updateReadmeVersion(path.join(rootDir, 'README.md'), newVersion);
  
  console.log(`\n🎉 Version bumped from ${currentVersion} to ${newVersion}`);
  console.log(`Next: git add . && git commit -m "chore: bump version to ${newVersion}"`);
}

if (require.main === module) {
  main();
}
