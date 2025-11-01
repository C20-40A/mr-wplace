#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const browser = process.argv[2]; // "chrome" or "firefox"
const outputPath = process.argv[3] || "./manifest.json";

if (!browser || !["chrome", "firefox"].includes(browser)) {
  console.error('Usage: node generate-manifest.js <chrome|firefox> [output-path]');
  process.exit(1);
}

// Load template
const templatePath = path.join(__dirname, "../manifest.template.json");
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

// Add browser-specific background field
if (browser === "chrome") {
  template.background = {
    service_worker: "service_worker.js"
  };
  console.log("🧑‍🎨 : Generated Chrome manifest.json");
} else if (browser === "firefox") {
  template.background = {
    scripts: ["service_worker.js"]
  };
  console.log("🧑‍🎨 : Generated Firefox manifest.json");
}

// Write output
fs.writeFileSync(outputPath, JSON.stringify(template, null, 2) + "\n");
console.log(`🧑‍🎨 : Written to ${outputPath}`);
