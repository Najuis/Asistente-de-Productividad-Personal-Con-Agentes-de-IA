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

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
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
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...(tools?.length ? { tools } : {}),
    });

    const message = completion.choices[0]?.message;
    if (!message) return { content: null };

    return {
      content: message.content,
      toolCalls: message.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}") as Record<
          string,
          unknown
        >,
      })),
    };
  }
}
