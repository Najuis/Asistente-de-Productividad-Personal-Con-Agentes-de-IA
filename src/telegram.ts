import { createProvider } from "./providers/index.js";
import { Orchestrator } from "./orchestrator/orchestrator.js";
import { logActivity } from "./activity.js";
import {
  isUserAuthorized,
  authorizeUser,
  removeUser,
  getUserDisplayName,
  type AuthorizedUser,
} from "./agents/tools/users.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const ALLOWED_STATIC = (process.env.TG_ALLOWED_CHAT ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error(
    "TELEGRAM_BOT_TOKEN no está configurada. Crea un bot con @BotFather y configúrala en .env"
  );
  process.exit(1);
}

if (!ADMIN_CHAT_ID) {
  console.warn(
    "⚠️  ADMIN_TELEGRAM_CHAT_ID no configurada. Las solicitudes de acceso no serán enviadas."
  );
}

const API = `https://api.telegram.org/bot${TOKEN}`;

interface TelegramMessage {
  chat: { id: number; type?: string };
  text?: string;
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  message_id: number;
}

interface CallbackQuery {
  id: string;
  from: { id: number };
  data: string;
  message?: { chat: { id: number }; message_id: number };
}

async function call(method: string, body: unknown): Promise<any> {
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
  `Bot de Telegram activo (proveedor: ${provider.name}).`
);
console.log(`Admin chat ID: ${ADMIN_CHAT_ID || "NO CONFIGURADO"}`);
console.log(`Chats estáticos permitidos: ${ALLOWED_STATIC.length ? ALLOWED_STATIC.join(", ") : "NINGUNO"}`);

function isAuthorized(chatId: number): boolean {
  const chatIdStr = String(chatId);
  return ALLOWED_STATIC.includes(chatIdStr) || isUserAuthorized(chatIdStr);
}

async function sendAuthorizationRequest(message: TelegramMessage): Promise<void> {
  if (!ADMIN_CHAT_ID) {
    await call("sendMessage", {
      chat_id: message.chat.id,
      text: "⚠️ El sistema de autorización no está configurado. Contacta al administrador.",
    });
    return;
  }

  const user = message.from;
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Sin nombre";
  const username = user?.username ? `@${user.username}` : "Sin username";
  const chatId = message.chat.id;

  const requestText = [
    "🔔 **Nueva solicitud de acceso**",
    "",
    `👤 Nombre: ${displayName}`,
    `📛 Username: ${username}`,
    `🆔 Chat ID: \`${chatId}\``,
    `📅 Fecha: ${new Date().toLocaleString("es-ES")}`,
    "",
    "¿Autorizar acceso al bot?",
  ].join("\n");

  await call("sendMessage", {
    chat_id: ADMIN_CHAT_ID,
    text: requestText,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Aceptar", callback_data: `auth_accept_${chatId}_${user?.username || "none"}_${user?.first_name || "none"}_${user?.last_name || "none"}` },
          { text: "❌ Rechazar", callback_data: `auth_reject_${chatId}` },
        ],
      ],
    },
  });

  await call("sendMessage", {
    chat_id: chatId,
    text: "⏳ Tu solicitud de acceso ha sido enviada al administrador. Recibirás una notificación cuando sea revisada.",
  });
}

async function handleCallbackQuery(callback: CallbackQuery): Promise<void> {
  const data = callback.data;
  const adminId = callback.from.id;

  // Verificar que quien responde es el admin
  if (ADMIN_CHAT_ID && String(adminId) !== ADMIN_CHAT_ID) {
    await call("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "❌ No tienes permisos para realizar esta acción.",
      show_alert: true,
    });
    return;
  }

  if (data.startsWith("auth_accept_")) {
    const parts = data.split("_");
    const chatId = parts[2];
    const username = parts[3] !== "none" ? parts[3] : undefined;
    const firstName = parts[4] !== "none" ? parts[4] : undefined;
    const lastName = parts[5] !== "none" ? parts.slice(5).join("_") : undefined;

    const user = authorizeUser(chatId, username, firstName, lastName, String(adminId));

    await call("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: `✅ Usuario ${getUserDisplayName(user)} autorizado.`,
    });

    // Editar mensaje original para mostrar que fue aceptado
    await call("editMessageText", {
      chat_id: callback.message?.chat.id,
      message_id: callback.message?.message_id,
      text: `✅ **Solicitud ACEPTADA**\n\nUsuario: ${getUserDisplayName(user)}\nChat ID: \`${chatId}\`\nAutorizado por: Admin`,
      parse_mode: "Markdown",
    });

    // Notificar al usuario
    await call("sendMessage", {
      chat_id: chatId,
      text: [
        "🎉 **¡Bienvenido!**",
        "",
        "Tu solicitud de acceso ha sido **aprobada**.",
        "",
        "Ahora puedes usar todas las funcionalidades del asistente:",
        "• 📝 Guardar notas y recordatorios",
        "• 🖥️ Controlar tu equipo",
        "• 💬 Conversar con la IA",
        "",
        "Escribe /help para ver todos los comandos disponibles.",
      ].join("\n"),
    });

    console.log(`✅ Usuario ${chatId} autorizado por admin`);
  } else if (data.startsWith("auth_reject_")) {
    const chatId = data.split("_")[2];

    await call("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: `❌ Solicitud de ${chatId} rechazada.`,
    });

    await call("editMessageText", {
      chat_id: callback.message?.chat.id,
      message_id: callback.message?.message_id,
      text: `❌ **Solicitud RECHAZADA**\n\nChat ID: \`${chatId}\`\nRechazado por: Admin`,
      parse_mode: "Markdown",
    });

    await call("sendMessage", {
      chat_id: chatId,
      text: "❌ Tu solicitud de acceso ha sido **rechazada** por el administrador.\n\nSi crees que esto es un error, contacta al administrador del sistema.",
    });

    console.log(`❌ Usuario ${chatId} rechazado por admin`);
  }
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim() ?? "";

  if (!text) {
    await call("sendMessage", {
      chat_id: chatId,
      text: "Solo acepto mensajes de texto.",
    });
    return;
  }

  // Comandos de admin
  if (ADMIN_CHAT_ID && String(chatId) === ADMIN_CHAT_ID) {
    if (text === "/listusers") {
      const { listAuthorizedUsers, getUserDisplayName } = await import("./agents/tools/users.js");
      const users = listAuthorizedUsers();
      
      if (users.length === 0) {
        await call("sendMessage", {
          chat_id: chatId,
          text: "📋 No hay usuarios autorizados dinámicamente.\n\nSolo los chats estáticos en TG_ALLOWED_CHAT tienen acceso.",
        });
        return;
      }

      const userList = users
        .map((u, i) => {
          const date = new Date(u.authorizedAt).toLocaleString("es-ES");
          return `${i + 1}. ${getUserDisplayName(u)}\n   ID: \`${u.chatId}\`\n   Autorizado: ${date}`;
        })
        .join("\n\n");

      await call("sendMessage", {
        chat_id: chatId,
        text: `📋 **Usuarios Autorizados** (${users.length})\n\n${userList}`,
        parse_mode: "Markdown",
      });
      return;
    }

    if (text.startsWith("/removeuser ")) {
      const targetId = text.split(" ")[1];
      const removed = removeUser(targetId);
      
      await call("sendMessage", {
        chat_id: chatId,
        text: removed
          ? `✅ Usuario \`${targetId}\` removido de la lista de autorizados.`
          : `❌ Usuario \`${targetId}\` no encontrado en la lista.`,
        parse_mode: "Markdown",
      });
      return;
    }
  }

  // Verificar autorización
  if (!isAuthorized(chatId)) {
    await sendAuthorizationRequest(message);
    return;
  }

  if (text === "/start" || text === "/help") {
    await call("sendMessage", {
      chat_id: chatId,
      text: [
        "🤖 **Asistente de Productividad**",
        "",
        "Puedo ayudarte con:",
        "• 📝 Guardar notas y recordatorios",
        "• 🖥️ Controlar tu equipo (abrir apps, procesos, capturas)",
        "• 💬 Conversar y responder preguntas",
        "",
        "**Ejemplos:**",
        "• \"apunta: comprar leche\"",
        "• \"recuérdame la reunión mañana a las 10\"",
        "• \"abre el navegador\"",
        "• \"toma una captura de pantalla\"",
        "",
        "Escribe lo que necesites en lenguaje natural.",
      ].join("\n"),
      parse_mode: "Markdown",
    });
    return;
  }

  try {
    await call("sendChatAction", { chat_id: chatId, action: "typing" });
    const { intent, reply } = await orchestrator.handle(text);
    await call("sendMessage", { chat_id: chatId, text: reply });
    logActivity({
      ts: Date.now(),
      source: "telegram",
      id: String(chatId),
      name: message.from?.first_name,
      intent,
      msgPreview: text.slice(0, 80),
    });
    console.log(`[${intent}] chat=${chatId}: ${text.slice(0, 80)}`);
  } catch (err) {
    console.error(`Error procesando mensaje: ${(err as Error).message}`);
    await call("sendMessage", {
      chat_id: chatId,
      text: "Ocurrió un error procesando tu mensaje. Intenta de nuevo.",
    });
  }
}

let offset = 0;

async function poll(): Promise<void> {
  try {
    const data = (await call("getUpdates", {
      offset,
      timeout: 25,
    })) as {
      ok: boolean;
      result?: Array<{
        update_id: number;
        message?: TelegramMessage;
        callback_query?: CallbackQuery;
      }>;
    };

    if (!data.ok || !data.result) return;

    for (const update of data.result) {
      offset = update.update_id + 1;
      if (update.message) {
        await handleMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
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
