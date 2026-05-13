#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFile = resolve(__dirname, "../client/src/lib/version.ts");

const content = readFileSync(versionFile, "utf8");
const versionMatch = content.match(/APP_VERSION\s*=\s*"(\d+)\.(\d+)\.(\d+)"/);

if (!versionMatch) {
  console.error("Could not parse current version from", versionFile);
  process.exit(1);
}

const [, major, minor, patch] = versionMatch;
const next = `${major}.${minor}.${Number(patch) + 1}`;

const today = new Date();
const dd = String(today.getDate()).padStart(2, "0");
const mm = String(today.getMonth() + 1).padStart(2, "0");
const yyyy = today.getFullYear();
const deployedAt = `${dd}/${mm}/${yyyy}`;

const updated = content
  .replace(/APP_VERSION\s*=\s*"[^"]+"/, `APP_VERSION = "${next}"`)
  .replace(/APP_DEPLOYED_AT\s*=\s*"[^"]+"/, `APP_DEPLOYED_AT = "${deployedAt}"`);

writeFileSync(versionFile, updated);
console.log(`Version bumped: ${versionMatch[0].split('"')[1]} -> ${next} (${deployedAt})`);
