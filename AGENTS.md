# AGENTS.md

Personal productivity chatbot: an orchestrator that routes messages to a tool-using agent or a plain chat reply, backed by a pluggable LLM provider.

## Commands

- `npm run dev` — run with `tsx watch src/index.ts` (interactive CLI).
- `npm run dev -- --once 'tu mensaje'` — run a single message and print `[intent] reply`; use for quick verification.
- `npm run typecheck` — `tsc --noEmit` (the only check available; there are **no lint or test scripts**).
- `npm run build` — `tsc` to `dist/`.
- `npm run serve` — HTTP server (`dist/server.js`): `POST /api/chat`, `GET /health`, `GET /` mobile chat page.
- `npm run bot` — Telegram bot (`dist/telegram.js`, long polling, no ports opened). Requires `TELEGRAM_BOT_TOKEN` + `TG_ALLOWED_CHAT`.
- For quick verification prefer `node dist/index.js --once 'msg'` — `tsx watch` never exits.

## ESM gotchas

- `"type": "module"` with `moduleResolution: NodeNext` — all relative imports **must** include the `.js` extension (e.g. `import { Orchestrator } from "../orchestrator/orchestrator.js"`), even though sources are `.ts`.

## Providers and env

- `LLM_PROVIDER` selects the provider (`openai` | `ollama` | `mock`), default `mock` — runs with no setup and no key. `openai` throws if `OPENAI_API_KEY` is missing.
- `OPENAI_BASE_URL` lets the OpenAI provider talk to any OpenAI-compatible API (DeepSeek: `https://api.deepseek.com`, model `deepseek-chat`).
- Env is loaded via `dotenv/config` inside `src/providers/index.ts:1`; copy `.env.example` to `.env` to configure.
- `.env` is gitignored — never commit it. `tools/nircmd.exe` (volume control) is also gitignored; download from nirsoft if missing.

## Architecture

- Entry `src/index.ts` → `Orchestrator` (`src/orchestrator/orchestrator.ts`) → either `AssistantAgent` (tool loop, `src/agents/assistant.ts`) or a direct provider chat.
- `src/server.ts` (HTTP) and `src/telegram.ts` (Telegram bot) build their own `Orchestrator` and are independent entrypoints.
- Intent detection is a **Spanish keyword regex** in `orchestrator.ts:13`; new intent keywords must be added there (accents are normalized via NFD).
- New tools require two edits in `src/agents/assistant.ts`: a `ToolDefinition` entry in `ASSISTANT_TOOLS` **and** a case in the `executeTool` switch (which is `async`). Tool results are fed back to the model as `tool`-role messages (with `toolCallId`/`name`); the loop caps at 5 iterations.
- System tools live in `src/agents/tools/system.ts`: they run Windows commands via `exec` with a `chcp 65001` prefix (UTF-8 output) or `spawn` detached with `stdio: "ignore"` (for `start`-launched apps — otherwise the child keeps Node's event loop alive).
- Destructive tools (`kill_process`, `shutdown_pc`) require explicit user confirmation in their descriptions; `TG_ALLOWED_CHAT` whitelists who can use the Telegram bot.
- The `ChatMessage` abstraction supports `tool` role; providers map it to their native format: OpenAI needs `tool_call_id` on tool messages and `tool_calls` on the preceding assistant message, Ollama needs `name` on tool messages.
- Providers (`src/providers/`) all implement the `LLMProvider` interface in `types.ts`; OpenAI and Ollama map their native tool-call formats to it.

## Data and conventions

- Notes/reminders persist to `data/notes.json` / `data/reminders.json` (sync fs, gitignored).
- All user-facing text, system prompts, and tool descriptions are **in Spanish** — keep new prompts and CLI output in Spanish.
