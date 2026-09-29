import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export function parseAccountFilename(filename) {
  const match = filename.match(/^(.+)_([^_]+)\.txt$/);

  if (!match) {
    return null;
  }

  return {
    name: match[1],
    server: match[2],
    filename
  };
}

export async function loadAccountGroups() {
  const dir = path.resolve(process.cwd(), config.accountsDir);
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const groups = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".txt")) {
      continue;
    }

    const parsed = parseAccountFilename(entry.name);

    if (!parsed) {
      console.warn(`[ACCOUNTS] Skip invalid filename: ${entry.name}`);
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const text = await fs.readFile(fullPath, "utf8");

    const seen = new Set();
    const fids = [];

    for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      // Keep compatibility with the Python parser:
      // comma/semicolon -> first field.
      let value = line;
      if (line.includes(",")) value = line.split(",")[0].trim();
      else if (line.includes(";")) value = line.split(";")[0].trim();

      if (value && !seen.has(value)) {
        seen.add(value);
        fids.push(value);
      }
    }

    groups.push({
      ...parsed,
      fids
    });
  }

  return groups;
}