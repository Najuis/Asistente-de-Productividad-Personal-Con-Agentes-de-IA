import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Note {
  id: number;
  text: string;
  createdAt: string;
}

const DATA_DIR = "data";
const FILE = `${DATA_DIR}/notes.json`;

function load(): Note[] {
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as Note[];
  } catch {
    return [];
  }
}

function save(notes: Note[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(notes, null, 2), "utf-8");
}

export function addNote(text: string): Note {
  const notes = load();
  const note: Note = {
    id: Date.now(),
    text,
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  save(notes);
  return note;
}

export function listNotes(): Note[] {
  return load();
}

export function deleteNote(id: number): boolean {
  const notes = load();
  const filtered = notes.filter((n) => n.id !== id);
  if (filtered.length === notes.length) return false;
  save(filtered);
  return true;
}
