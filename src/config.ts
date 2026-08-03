import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const DATA_DIR = resolve(__dirname, "..", "data");
const CONFIG_FILE = resolve(DATA_DIR, "config.json");

interface AppConfig {
  provider: string;
  model: string;
  adminPasswordHash?: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadConfig(): AppConfig {
  ensureDataDir();
  if (existsSync(CONFIG_FILE)) {
    try {
      const raw = readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(raw) as AppConfig;
    } catch {
      return getDefaultConfig();
    }
  }
  return getDefaultConfig();
}

function getDefaultConfig(): AppConfig {
  return {
    provider: process.env.LLM_PROVIDER ?? "gemini",
    model: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
    adminPasswordHash: process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : undefined,
  };
}

function saveConfig(config: AppConfig) {
  ensureDataDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash?: string): boolean {
  if (!hash) return false;
  const inputHash = createHash("sha256").update(password).digest("hex");
  return inputHash === hash;
}

let cachedConfig: AppConfig | null = null;
let lastMtime = 0;

export function getConfig(): AppConfig {
  try {
    const stats = statSync(CONFIG_FILE);
    if (cachedConfig === null || stats.mtimeMs > lastMtime) {
      cachedConfig = loadConfig();
      lastMtime = stats.mtimeMs;
    }
  } catch {
    if (cachedConfig === null) {
      cachedConfig = getDefaultConfig();
    }
  }
  return cachedConfig;
}

export function setModelConfig(model: string) {
  const config = getConfig();
  config.model = model;
  saveConfig(config);
  cachedConfig = config;
}

export function setProviderConfig(provider: string) {
  const config = getConfig();
  config.provider = provider;
  saveConfig(config);
  cachedConfig = config;
}

export { verifyPassword, hashPassword };