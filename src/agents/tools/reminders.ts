import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export interface Reminder {
  id: number;
  text: string;
  dueAt: string;
  createdAt: string;
}

const DATA_DIR = "data";
const FILE = `${DATA_DIR}/reminders.json`;

function load(): Reminder[] {
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as Reminder[];
  } catch {
    return [];
  }
}

function save(reminders: Reminder[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(reminders, null, 2), "utf-8");
}

export function addReminder(text: string, dueAt: string): Reminder {
  const reminders = load();
  const reminder: Reminder = {
    id: Date.now(),
    text,
    dueAt,
    createdAt: new Date().toISOString(),
  };
  reminders.push(reminder);
  save(reminders);
  return reminder;
}

export function listReminders(): Reminder[] {
  return load();
}

export function deleteReminder(id: number): boolean {
  const reminders = load();
  const filtered = reminders.filter((r) => r.id !== id);
  if (filtered.length === reminders.length) return false;
  save(filtered);
  return true;
}
