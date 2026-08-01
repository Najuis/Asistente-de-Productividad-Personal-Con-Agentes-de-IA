import type {
  ChatMessage,
  ChatResult,
  LLMProvider,
  ToolCall,
  ToolDefinition,
} from "../providers/types.js";
import { addNote, deleteNote, listNotes } from "./tools/notes.js";
import {
  addReminder,
  deleteReminder,
  listReminders,
} from "./tools/reminders.js";

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    name: "add_note",
    description: "Guarda una nota de texto. Úsala cuando el usuario quiera apuntar algo.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "list_notes",
    description: "Lista todas las notas guardadas.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "delete_note",
    description: "Elimina una nota por su id.",
    parameters: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
    },
  },
  {
    name: "add_reminder",
    description: "Crea un recordatorio con fecha ISO (ej: 2026-08-02T09:00:00).",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
        dueAt: { type: "string" },
      },
      required: ["text", "dueAt"],
    },
  },
  {
    name: "list_reminders",
    description: "Lista todos los recordatorios.",
    parameters: { type: "object", properties: {} },
  },
];

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return `Eres un asistente de productividad personal.
Puedes guardar notas y recordatorios usando tus herramientas.
Responde siempre en español, de forma breve y útil.
Hoy es ${today}. Si el usuario pide recordar algo sin fecha, usa mañana (${tomorrow}) a las 09:00.
Usa add_note solo para apuntes y notas; usa add_reminder solo cuando el usuario pida recordar algo con fecha u hora.
Ejecuta cada herramienta una sola vez y después responde al usuario en texto breve confirmando lo hecho. Nunca vuelvas a llamar herramientas una vez ejecutadas.`;
}

export class AssistantAgent {
  constructor(private provider: LLMProvider) {}

  async run(userMessage: string): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userMessage },
    ];

    const executed: ToolCall[] = [];
    const maxIterations = 5;

    for (let i = 0; i < maxIterations; i++) {
      const result: ChatResult = await this.provider.chat(messages, {
        tools: ASSISTANT_TOOLS,
      });

      if (!result.toolCalls?.length) {
        return {
          content: result.content ?? "No tengo respuesta.",
          toolCalls: executed,
        };
      }

      for (const call of result.toolCalls) {
        const output = executeTool(call);
        executed.push(call);
        messages.push({
          role: "assistant",
          content: `Ejecutando ${call.name}`,
        });
        messages.push({
          role: "user",
          content: `Resultado de ${call.name}: ${output}`,
        });
      }
    }

    throw new Error("El asistente superó el máximo de iteraciones de herramientas.");
  }
}

function executeTool(call: ToolCall): string {
  const args = call.arguments;
  switch (call.name) {
    case "add_note": {
      const note = addNote(String(args.text));
      return `Nota #${note.id} guardada.`;
    }
    case "list_notes": {
      const notes = listNotes();
      return notes.length
        ? JSON.stringify(notes)
        : "No hay notas guardadas.";
    }
    case "delete_note": {
      return deleteNote(Number(args.id))
        ? `Nota #${args.id} eliminada.`
        : `No existe la nota #${args.id}.`;
    }
    case "add_reminder": {
      const reminder = addReminder(String(args.text), String(args.dueAt));
      return `Recordatorio #${reminder.id} creado para ${reminder.dueAt}.`;
    }
    case "list_reminders": {
      const reminders = listReminders();
      return reminders.length
        ? JSON.stringify(reminders)
        : "No hay recordatorios.";
    }
    default:
      return `Herramienta desconocida: ${call.name}`;
  }
}
