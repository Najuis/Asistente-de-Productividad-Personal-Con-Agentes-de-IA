import { createProvider } from "./providers/index.js";
import { Orchestrator } from "./orchestrator/orchestrator.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED = (process.env.TG_ALLOWED_CHAT ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error(
    "TELEGRAM_BOT_TOKEN no está configurada. Crea un bot con @BotFather y configúrala en .env"
  );
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

async function call(method: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const provider = createProvider();
const orchestrator = new Orchestrator(provider);

console.log(
  `Bot de Telegram activo (proveedor: ${provider.name}). Chats permitidos: ${
    ALLOWED.length ? ALLOWED.join(", ") : "NINGUNO - configura TG_ALLOWED_CHAT"
  }`
);

let offset = 0;

async function handleMessage(message: {
  chat: { id: number };
  text?: string;
  from?: { first_name?: string };
}): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim() ?? "";

  if (ALLOWED.length && !ALLOWED.includes(String(chatId))) {
    await call("sendMessage", {
      chat_id: chatId,
      text: "No autorizado para usar este asistente.",
    });
    return;
  }

  if (!text) {
    await call("sendMessage", {
      chat_id: chatId,
      text: "Solo acepto mensajes de texto.",
    });
    return;
  }

  if (text === "/start" || text === "/help") {
    await call("sendMessage", {
      chat_id: chatId,
      text: "🤖 Asistente de productividad.\n\nPuedo guardar notas y recordatorios, y controlar tu equipo: abrir apps y URLs, listar archivos y procesos, capturas de pantalla, volumen, brillo, apagado y red.\n\nEscribe lo que necesites.",
    });
    return;
  }

  try {
    await call("sendChatAction", { chat_id: chatId, action: "typing" });
    const { intent, reply } = await orchestrator.handle(text);
    await call("sendMessage", { chat_id: chatId, text: reply });
    console.log(`[${intent}] chat=${chatId}: ${text.slice(0, 80)}`);
  } catch (err) {
    console.error(`Error procesando mensaje: ${(err as Error).message}`);
    await call("sendMessage", {
      chat_id: chatId,
      text: "Ocurrió un error procesando tu mensaje. Intenta de nuevo.",
    });
  }
}

async function poll(): Promise<void> {
  try {
    const data = (await call("getUpdates", {
      offset,
      timeout: 25,
    })) as {
      ok: boolean;
      result?: Array<{
        update_id: number;
        message?: {
          chat: { id: number };
          text?: string;
          from?: { first_name?: string };
        };
      }>;
    };

    if (!data.ok || !data.result) return;

    for (const update of data.result) {
      offset = update.update_id + 1;
      if (update.message) await handleMessage(update.message);
    }
  } catch (err) {
    console.error(`Error en polling: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  while (true) {
    await poll();
    await new Promise((r) => setTimeout(r, 500));
  }
}

main();
