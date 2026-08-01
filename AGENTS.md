# AGENTS.md

Personal productivity chatbot: an orchestrator that routes messages to a tool-using agent or a plain chat reply, backed by a pluggable LLM provider.

## Commands

- `npm run dev` — run with `tsx watch src/index.ts` (interactive CLI).
- `npm run dev -- --once 'tu mensaje'` — run a single message and print `[intent] reply`; use for quick verification.
- `npm run typecheck` — `tsc --noEmit` (the only check available; there are **no lint or test scripts**).
- `npm run build` — `tsc` to `dist/` (entry: `dist/index.js`).

## ESM gotchas

- `"type": "module"` with `moduleResolution: NodeNext` — all relative imports **must** include the `.js` extension (e.g. `import { Orchestrator } from "../orchestrator/orchestrator.js"`), even though sources are `.ts`.

## Providers and env

- `LLM_PROVIDER` selects the provider (`openai` | `ollama` | `mock`), default `mock` — runs with no setup and no key. `openai` throws if `OPENAI_API_KEY` is missing.
- Env is loaded via `dotenv/config` inside `src/providers/index.ts:1`; copy `.env.example` to `.env` to configure.

## Architecture

- Entry `src/index.ts` → `Orchestrator` (`src/orchestrator/orchestrator.ts`) → either `AssistantAgent` (tool loop, `src/agents/assistant.ts`) or a direct provider chat.
- Intent detection is a **Spanish keyword regex** in `orchestrator.ts:13`; new intent keywords must be added there.
- New tools require two edits in `src/agents/assistant.ts`: a `ToolDefinition` entry in `ASSISTANT_TOOLS` **and** a case in the `executeTool` switch. Tool results are fed back to the model as user messages; the loop caps at 5 iterations.
- Providers (`src/providers/`) all implement the `LLMProvider` interface in `types.ts`; OpenAI and Ollama map their native tool-call formats to it.

## Data and conventions

- Notes/reminders persist to `data/notes.json` / `data/reminders.json` (sync fs, gitignored).
- All user-facing text, system prompts, and tool descriptions are **in Spanish** — keep new prompts and CLI output in Spanish.
