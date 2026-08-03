import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const DATA_DIR = resolve(__dirname, "..", "data");
const ACTIVITY_FILE = resolve(DATA_DIR, "activity.jsonl");

interface ActivityEntry {
  ts: number;
  source: "web" | "telegram";
  id: string;
  name?: string;
  ip?: string;
  intent?: string;
  msgPreview?: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function logActivity(entry: ActivityEntry) {
  ensureDataDir();
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(ACTIVITY_FILE, line, "utf8");
}

export function getRecentActivity(limit = 200): ActivityEntry[] {
  ensureDataDir();
  if (!existsSync(ACTIVITY_FILE)) return [];
  try {
    const content = readFileSync(ACTIVITY_FILE, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries = lines.map((l) => JSON.parse(l) as ActivityEntry);
    return entries.slice(-limit);
  } catch {
    return [];
  }
}