# Asistente de Productividad Personal con Agentes de IA

Chatbot de productividad personal: un orquestador que enruta cada mensaje a un agente con herramientas (notas y recordatorios) o a un chat directo, respaldado por proveedores de IA intercambiables.

## Características

- Detección de intención por palabras clave en español (notas, recordatorios, tareas).
- Agente con herramientas: `add_note`, `list_notes`, `delete_note`, `add_reminder`, `list_reminders`.
- Proveedores intercambiables: **OpenAI**, **Ollama** (local y gratuito) y **mock** (sin configuración).
- Persistencia local de datos en `data/notes.json` y `data/reminders.json`.
- Modo interactivo (CLI) y modo de un solo mensaje (`--once`).

## Requisitos

- Node.js 18 o superior (usa `fetch` nativo).
- Opcional: [Ollama](https://ollama.com) para el proveedor local, o una clave de API de OpenAI.

## Instalación

```bash
npm install
cp .env.example .env   # en Windows: copy .env.example .env
```

## Configuración

Edita `.env`:

| Variable         | Descripción                                   | Valores / ejemplo      |
|------------------|-----------------------------------------------|------------------------|
| `LLM_PROVIDER`   | Proveedor de IA                               | `mock` (default), `openai`, `ollama` |
| `OPENAI_API_KEY` | Clave de API de OpenAI (si usas `openai`)     | `sk-...`               |
| `OPENAI_MODEL`   | Modelo de OpenAI                               | `gpt-4o-mini` (default)|
| `OLLAMA_MODEL`   | Modelo local de Ollama                         | `qwen2.5:3b`           |

Con Ollama, descarga primero el modelo:

```bash
ollama pull qwen2.5:3b
```

> Nota para equipos con poca RAM: modelos como `qwen2.5:7b` requieren ~5 GB libres; usa `qwen2.5:3b` (~2 GB) si tienes 8 GB o menos.

## Uso

Chat interactivo:

```bash
npm start        # usa dist/ (compilado)
npm run dev      # modo desarrollo con recarga automática
```

Un solo mensaje (útil para pruebas y scripts):

```bash
node dist/index.js --once 'apunta: comprar leche'
```

La respuesta se imprime como `[intent] respuesta`, donde `intent` es `assistant` (usó herramientas) o `chat` (respuesta directa).

## Comandos de desarrollo

```bash
npm run typecheck   # tsc --noEmit (única verificación disponible)
npm run build       # compila a dist/
```

## Estructura

```
src/
  index.ts                  # punto de entrada
  orchestrator/             # enrutador de intención (regex en español)
  agents/assistant.ts       # agente con bucle de herramientas (máx. 5 iteraciones)
  agents/tools/             # implementación de notas y recordatorios
  providers/                # OpenAI, Ollama y mock (interfaz LLMProvider)
  chatbot/cli.ts            # CLI interactiva
data/                       # notas y recordatorios (JSON, gitignored)
```

## Cómo agregar una herramienta

En `src/agents/assistant.ts` se requieren dos cambios: una entrada `ToolDefinition` en `ASSISTANT_TOOLS` y un caso en el `executeTool`.

## Autor

**Miguel Angel Diaz Gomez** — [LinkedIn](https://www.linkedin.com/in/miguel-angel-diaz-gomez-a83102220)

## Licencia

Privado / uso personal.
