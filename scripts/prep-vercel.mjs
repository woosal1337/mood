#!/usr/bin/env node

import { rmSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(root, "public");
const MEDIA = join(PUBLIC, "media");
const base = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "");
const ci = Boolean(process.env.VERCEL || process.env.CI);

const payloadPath = join(PUBLIC, "data", "mood.json");
if (!existsSync(payloadPath)) {
  console.error("public/data/mood.json is missing. Run `npm run data` and commit it.");
  process.exit(1);
}
const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
console.log(`payload  ${payload.counts.items} items, ${payload.counts.boards} boards`);

const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
function weigh(dir) {
  let bytes = 0, files = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else { bytes += s.size; files++; }
    }
  };
  if (existsSync(dir)) walk(dir);
  return { bytes, files };
}

if (base) {
  console.log(`media    ${base}`);
  if (!ci) {
    console.log("not a CI checkout, leaving public/media in place");
    process.exit(0);
  }
  if (existsSync(MEDIA)) {
    const { bytes, files } = weigh(MEDIA);
    rmSync(MEDIA, { recursive: true, force: true });
    console.log(`removed  public/media from the checkout (${files} files, ${mb(bytes)})`);
  }
  process.exit(0);
}

const { bytes, files } = weigh(MEDIA);
console.log(`media    bundled from public/media (${files} files, ${mb(bytes)})`);

if (files === 0) {
  console.error("");
  console.error("No media, and no NEXT_PUBLIC_MEDIA_BASE to serve it from.");
  console.error("");
  console.error("The build would succeed and every tile would 404. Either:");
  console.error("  · set NEXT_PUBLIC_MEDIA_BASE to a bucket holding /media/..., or");
  console.error("  · stop excluding public/media so it ships inside the deployment");
  console.error("");
  process.exit(1);
}
if (bytes > 100 * 1048576) {
  console.log("");
  console.log(`WARNING  Vercel caps static uploads at 100 MB on Hobby and 1 GB on Pro.`);
  console.log(`         This deployment carries ${mb(bytes)} of media, so a Hobby build will`);
  console.log(`         finish and then fail at "Deploying outputs...".`);
  console.log(`         Set NEXT_PUBLIC_MEDIA_BASE to serve the media from a bucket instead.`);
  console.log("");
}
