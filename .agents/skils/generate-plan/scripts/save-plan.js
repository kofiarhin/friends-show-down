#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function extractTitle(markdown) {
  const firstHeading = markdown.match(/^#\s+(.+)$/m);

  if (firstHeading && firstHeading[1]) {
    return firstHeading[1].trim();
  }

  return "generated-plan";
}

function main() {
  const [, , fallbackTitle, tempFilePath] = process.argv;

  if (!tempFilePath) {
    console.error(
      'Usage: node .agents/skills/generate-plan/scripts/save-plan.js "<title>" "<temp-file>"',
    );
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const planDir = path.join(projectRoot, "_plan");

  ensureDir(planDir);

  const resolvedTempFilePath = path.resolve(tempFilePath);

  if (!fs.existsSync(resolvedTempFilePath)) {
    console.error(`Temp file not found: ${resolvedTempFilePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedTempFilePath, "utf8");
  const title = extractTitle(content) || fallbackTitle || "generated-plan";
  const safeName = slugify(title);
  const fileName = `${safeName}-${getTimestamp()}.md`;
  const outputPath = path.join(planDir, fileName);

  fs.writeFileSync(outputPath, content, "utf8");

  console.log(outputPath);
}

main();
