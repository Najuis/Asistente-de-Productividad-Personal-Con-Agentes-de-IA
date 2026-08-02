import OpenAI from "openai";
import type {
  ChatMessage,
  ChatResult,
  LLMProvider,
  ToolDefinition,
} from "./types.js";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini", baseUrl?: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
  }

  async chat(
    messages: ChatMessage[],
    options?: { tools?: ToolDefinition[] }
  ): Promise<ChatResult> {
    const tools = options?.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => {
        if (m.role === "assistant" && m.toolCalls?.length) {
          return {
            role: "assistant" as const,
            content: m.content,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id ?? `call_${Date.now()}_${tc.name}`,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
        }
        if (m.role === "tool") {
          return {
            role: "tool" as const,
            content: m.content,
            tool_call_id: m.toolCallId ?? `call_${Date.now()}`,
          };
        }
        return { role: m.role, content: m.content };
      }),
      ...(tools?.length ? { tools } : {}),
    });

    const message = completion.choices[0]?.message;
    if (!message) return { content: null };

    return {
      content: message.content,
      toolCalls: message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}") as Record<
          string,
          unknown
        >,
      })),
    };
  }
}
