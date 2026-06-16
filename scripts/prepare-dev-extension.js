#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const out = path.join(root, ".dev-extension");

const copy = (from, to) => {
  fs.cpSync(path.join(root, from), path.join(out, to), {
    recursive: true,
    force: true,
  });
};

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

copy("popup.html", "popup.html");
copy("service_worker.js", "service_worker.js");
copy("icons", "icons");
copy("_locales", "_locales");
copy("public/assets", "assets");

execFileSync(process.execPath, [
  path.join(root, "scripts/generate-manifest.js"),
  "chrome",
  path.join(out, "manifest.json"),
], { stdio: "inherit" });
