import type {
  ChatMessage,
  ChatResult,
  LLMProvider,
  ToolDefinition,
} from "./types.js";

interface OllamaResponse {
  message?: {
    content?: string | null;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  error?: string;
}

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  private baseUrl: string;
  private model: string;

  constructor(model = "llama3.2", baseUrl = "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async chat(
    messages: ChatMessage[],
    options?: { tools?: ToolDefinition[] }
  ): Promise<ChatResult> {
    const payload: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
    };
    if (options?.tools?.length) {
      payload.tools = options.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as OllamaResponse;
    if (!res.ok) throw new Error(`Ollama error: ${data.error ?? res.status}`);

    const message = data.message;
    if (!message) return { content: null };

    return {
      content: message.content ?? null,
      toolCalls: message.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: tc.function.arguments ?? {},
      })),
    };
  }
}
