#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function slugify(value) {
  return value
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

function resolveProjectRoot() {
  return process.cwd();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const [, , rawTitle, contentFilePath] = process.argv;

  if (!rawTitle || !contentFilePath) {
    console.error(
      'Usage: node .agents/skills/prompt-generator/scripts/save-prompt.js "<title>" "<content-file>"',
    );
    process.exit(1);
  }

  const projectRoot = resolveProjectRoot();
  const promptDir = path.join(projectRoot, "_prompt");

  ensureDir(promptDir);

  const content = fs.readFileSync(path.resolve(contentFilePath), "utf8");

  const safeName = slugify(rawTitle) || "generated-prompt";
  const fileName = `${safeName}-${getTimestamp()}.md`;
  const outputPath = path.join(promptDir, fileName);

  fs.writeFileSync(outputPath, content, "utf8");

  console.log(`Saved prompt to: ${outputPath}`);
}

main();
