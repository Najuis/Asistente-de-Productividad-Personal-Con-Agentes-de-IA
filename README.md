# Asistente de Productividad Personal con Agentes de IA

Chatbot de productividad personal: un orquestador que enruta cada mensaje a un agente con herramientas (notas y recordatorios) o a un chat directo, respaldado por proveedores de IA intercambiables.

## Características

- Detección de intención por palabras clave en español (notas, recordatorios, tareas, control del equipo).
- Agente con herramientas: notas, recordatorios **y control del PC** (abrir apps/URLs, procesos, archivos, captura de pantalla, volumen, brillo, apagado, red, información del sistema).
- Proveedores intercambiables: **OpenAI-compatible** (DeepSeek, etc.), **Ollama** (local y gratuito) y **mock** (sin configuración).
- Persistencia local de datos en `data/notes.json`, `data/reminders.json` y capturas en `data/screenshots/`.
- Modo interactivo (CLI), modo de un solo mensaje (`--once`), **servidor web** y **bot de Telegram** para usarlo desde el celular.

## Requisitos

- Node.js 18 o superior (usa `fetch` nativo).
- Opcional: [Ollama](https://ollama.com) para el proveedor local, o una clave de API de DeepSeek/OpenAI.
- Opcional: `tools/nircmd.exe` para control de volumen ([nirsoft.net/utils/nircmd.zip](https://www.nirsoft.net/utils/nircmd.zip), descomprimir en `tools/`).

## Instalación

```bash
npm install
cp .env.example .env   # en Windows: copy .env.example .env
```

## Configuración

Edita `.env`:

| Variable            | Descripción                                   | Valores / ejemplo           |
|---------------------|-----------------------------------------------|-----------------------------|
| `LLM_PROVIDER`      | Proveedor de IA                               | `mock` (default), `openai`, `ollama` |
| `OPENAI_API_KEY`    | Clave de API (OpenAI o DeepSeek)              | `sk-...`                    |
| `OPENAI_MODEL`      | Modelo                                        | `deepseek-chat`, `gpt-4o-mini` |
| `OPENAI_BASE_URL`   | URL base para APIs compatibles con OpenAI     | `https://api.deepseek.com`  |
| `OLLAMA_MODEL`      | Modelo local de Ollama                        | `qwen2.5:3b`                |
| `PORT`              | Puerto del servidor web                       | `3000`                      |
| `TELEGRAM_BOT_TOKEN`| Token del bot de Telegram (con @BotFather)    | `123456:AA...`              |
| `TG_ALLOWED_CHAT`   | Chats autorizados para el bot (separados por coma) | `123456789`            |

**DeepSeek (recomendado):** crea la clave en [platform.deepseek.com](https://platform.deepseek.com) → API Keys, y configura:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=deepseek-chat
OPENAI_BASE_URL=https://api.deepseek.com
```

**Ollama local:** descarga primero el modelo:

```bash
ollama pull qwen2.5:3b
```

> Nota para equipos con poca RAM: modelos como `qwen2.5:7b` requieren ~5 GB libres; usa `qwen2.5:3b` (~2 GB) si tienes 8 GB o menos. Además, los modelos locales pequeños (3b) tienen dificultades para elegir bien entre 17 herramientas — la API de DeepSeek es mucho más fiable.

## Uso

Chat interactivo en el PC:

```bash
npm start        # usa dist/ (compilado)
npm run dev      # modo desarrollo con recarga automática
```

Un solo mensaje (útil para pruebas y scripts):

```bash
node dist/index.js --once 'apunta: comprar leche'
```

La respuesta se imprime como `[intent] respuesta`, donde `intent` es `assistant` (usó herramientas) o `chat` (respuesta directa).

### Desde el celular — servidor web

```bash
npm run serve
```

- En el PC: `http://localhost:3000`
- En la misma red Wi-Fi: `http://IP-DE-TU-PC:3000`
- Desde cualquier lugar (gratis): `winget install cloudflare.cloudflared` y luego `cloudflared tunnel --url http://localhost:3000` → te da una URL pública `https://xxx.trycloudflare.com`

### Desde el celular — bot de Telegram

1. En Telegram, habla con **@BotFather** → `/newbot` → te da el token.
2. Obtén tu chat id con **@userinfobot**.
3. En `.env`: `TELEGRAM_BOT_TOKEN=<token>` y `TG_ALLOWED_CHAT=<tu-chat-id>`.
4. En el PC: `npm run bot` (debe quedar encendido; usa PM2 para 24/7).

### Ejecución 24/7 con PM2

```bash
npm i -g pm2
pm2 start dist/server.js --name web
pm2 start dist/telegram.js --name bot
pm2 save
pm2 startup
```

Ejemplos de uso con el asistente:

```
"apunta: comprar leche"
"recuérdame la reunión mañana a las 10"
"dime la información del sistema"
"abre el navegador en github.com"
"toma una captura de pantalla"
"sube el volumen a 50"
"¿hay internet?"
"lista los procesos"
"apaga el PC"  (pide confirmación)
```

## Comandos de desarrollo

```bash
npm run typecheck   # tsc --noEmit (única verificación disponible)
npm run build       # compila a dist/
```

## Estructura

```
src/
  index.ts                  # punto de entrada (CLI)
  server.ts                 # servidor web (POST /api/chat, GET /health, página móvil)
  telegram.ts               # bot de Telegram (polling, lista blanca de chats)
  orchestrator/             # enrutador de intención (regex en español)
  agents/assistant.ts       # agente con bucle de herramientas (máx. 5 iteraciones)
  agents/tools/             # notas, recordatorios y herramientas de sistema
  providers/                # OpenAI-compatible, Ollama y mock (interfaz LLMProvider)
  chatbot/cli.ts            # CLI interactiva
data/                       # notas, recordatorios y capturas (gitignored)
tools/                      # nircmd.exe para volumen (gitignored)
```

## Cómo agregar una herramienta

En `src/agents/assistant.ts` se requieren dos cambios: una entrada `ToolDefinition` en `ASSISTANT_TOOLS` y un caso en el `executeTool`.

## Autor

**Miguel Angel Diaz Gomez** — [LinkedIn](https://www.linkedin.com/in/miguel-angel-diaz-gomez-a83102220)

## Licencia

Privado / uso personal.
