export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatResult {
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface LLMProvider {
  readonly name: string;
  chat(
    messages: ChatMessage[],
    options?: { tools?: ToolDefinition[] }
  ): Promise<ChatResult>;
}
