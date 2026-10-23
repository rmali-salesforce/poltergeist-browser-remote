#!/usr/bin/env node
// Bootstrap .env from example.env if it is missing.
// Exits non-zero after creating it so the caller stops before deploying to
// placeholder paths; no-ops (exit 0) when .env already exists.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const templatePath = path.join(root, "example.env");

if (fs.existsSync(envPath)) {
  process.exit(0);
}

if (!fs.existsSync(templatePath)) {
  console.error("error: example.env not found; cannot bootstrap .env");
  process.exit(1);
}

fs.copyFileSync(templatePath, envPath);
console.error("Created .env from example.env.");
console.error("Edit .env with your real paths, then re-run this command.");
process.exit(1);
