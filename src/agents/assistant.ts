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
import {
  checkNetwork,
  getSystemInfo,
  killProcess,
  listDirectory,
  listProcesses,
  openApp,
  openUrl,
  readFile,
  setBrightness,
  setVolume,
  shutdownPc,
  takeScreenshot,
} from "./tools/system.js";

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
  {
    name: "get_system_info",
    description:
      "Muestra información del sistema: SO, hostname, CPU, memoria RAM usada/libre y discos.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "open_app",
    description:
      "Abre una aplicación o programa en el equipo (ej: navegador, chrome, notepad, explorador, calculadora, cmd, vscode, word, excel, paint, powershell).",
    parameters: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "open_url",
    description: "Abre una URL (http/https) en el navegador por defecto.",
    parameters: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "list_directory",
    description:
      "Lista el contenido de un directorio (por defecto el directorio actual).",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
    },
  },
  {
    name: "read_file",
    description: "Lee el contenido de un archivo de texto.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "list_processes",
    description: "Lista los procesos en ejecución con su pid.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "kill_process",
    description:
      "Termina un proceso por nombre o pid. EJECUTA SOLO si el usuario confirmó explícitamente (dijo 'sí', 'confirma' o 'adelante').",
    parameters: {
      type: "object",
      properties: { target: { type: "string" } },
      required: ["target"],
    },
  },
  {
    name: "take_screenshot",
    description: "Toma una captura de pantalla y la guarda en data/screenshots.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "check_network",
    description: "Comprueba si hay conexión a internet.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "shutdown_pc",
    description:
      "Apaga, reinicia o cierra sesión en el equipo (action: shutdown | restart | logout). EJECUTA SOLO si el usuario confirmó explícitamente.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["shutdown", "restart", "logout"] },
      },
      required: ["action"],
    },
  },
  {
    name: "set_volume",
    description: "Ajusta el volumen del sistema (0 a 100).",
    parameters: {
      type: "object",
      properties: { level: { type: "number" } },
      required: ["level"],
    },
  },
  {
    name: "set_brightness",
    description:
      "Ajusta el brillo de la pantalla (0 a 100). Puede no funcionar en todos los equipos.",
    parameters: {
      type: "object",
      properties: { level: { type: "number" } },
      required: ["level"],
    },
  },
];

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return `Eres un asistente de productividad personal que también controla el equipo del usuario (Windows).
Puedes guardar notas y recordatorios, y ejecutar herramientas de sistema: abrir apps y URLs, listar archivos y procesos, capturas de pantalla, volumen, brillo, apagado y red.
Responde siempre en español, de forma breve y útil.
Hoy es ${today}. Si el usuario pide recordar algo sin fecha, usa mañana (${tomorrow}) a las 09:00.
Usa add_note solo para apuntes y notas; usa add_reminder solo cuando el usuario pida recordar algo con fecha u hora.
Para acciones destructivas (kill_process, shutdown_pc) exige que el usuario confirme explícitamente con 'sí', 'confirma' o 'adelante' antes de ejecutarlas.
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
        const output = await executeTool(call);
        executed.push(call);
        messages.push({
          role: "assistant",
          content: `Ejecutando ${call.name}`,
          toolCalls: result.toolCalls,
        });
        messages.push({
          role: "tool",
          content: output,
          toolCallId: call.id,
          name: call.name,
        });
      }
    }

    throw new Error("El asistente superó el máximo de iteraciones de herramientas.");
  }
}

async function executeTool(call: ToolCall): Promise<string> {
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
    case "get_system_info":
      return await getSystemInfo();
    case "open_app":
      return await openApp(String(args.name));
    case "open_url":
      return await openUrl(String(args.url));
    case "list_directory":
      return await listDirectory(args.path ? String(args.path) : ".");
    case "read_file":
      return readFile(String(args.path));
    case "list_processes":
      return await listProcesses();
    case "kill_process":
      return await killProcess(String(args.target));
    case "take_screenshot":
      return await takeScreenshot();
    case "check_network":
      return await checkNetwork();
    case "shutdown_pc":
      return await shutdownPc(
        args.action as "shutdown" | "restart" | "logout"
      );
    case "set_volume":
      return await setVolume(Number(args.level));
    case "set_brightness":
      return await setBrightness(Number(args.level));
    default:
      return `Herramienta desconocida: ${call.name}`;
  }
}
