import { GoogleGenAI } from "@google/genai";
import type {
  ChatMessage,
  ChatResult,
  LLMProvider,
  ToolDefinition,
} from "./types.js";
import { getConfig } from "../config.js";

interface GeminiStep {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
  name?: string;
  id?: string;
  arguments?: Record<string, unknown>;
  call_id?: string;
  is_error?: boolean;
  result?: unknown;
}

interface GeminiFunctionTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private ai: GoogleGenAI;
  private rawTurns: GeminiStep[][] = [];

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private getModel(): string {
    return getConfig().model;
  }

  private toFunctionTool(t: ToolDefinition): GeminiFunctionTool {
    return {
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    };
  }

  private toSteps(messages: ChatMessage[]): GeminiStep[] {
    const steps: GeminiStep[] = [];
    for (const m of messages) {
      if (m.role === "system") {
        continue;
      }
      if (m.role === "user") {
        steps.push({
          type: "user_input",
          content: [{ type: "text", text: m.content }],
        });
      } else if (m.role === "assistant" && m.toolCalls?.length) {
        const raw = this.rawTurns.shift();
        if (raw?.length) {
          steps.push(...raw);
        } else {
          steps.push(
            ...m.toolCalls.map((tc) => ({
              type: "function_call",
              id: tc.id ?? `call_${Date.now()}`,
              name: tc.name,
              arguments: tc.arguments,
            }))
          );
        }
      } else if (m.role === "assistant") {
        const raw = this.rawTurns.shift();
        if (raw?.length) {
          steps.push(...raw);
        } else {
          steps.push({
            type: "model_output",
            content: [{ type: "text", text: m.content }],
          });
        }
      } else if (m.role === "tool") {
        steps.push({
          type: "function_result",
          call_id: m.toolCallId ?? `call_${Date.now()}`,
          name: m.name,
          is_error: false,
          result: [{ type: "text", text: m.content }],
        });
      }
    }
    return steps;
  }

  private fromSteps(steps: GeminiStep[]): ChatResult {
    const toolCalls: ChatResult["toolCalls"] = [];
    const texts: string[] = [];

    for (const step of steps ?? []) {
      if (step.type === "function_call") {
        toolCalls.push({
          id: step.id,
          name: step.name ?? "",
          arguments: step.arguments ?? {},
        });
      } else if (step.type === "model_output") {
        const t = step.content
          ?.filter((c) => c.type === "text" && c.text)
          .map((c) => c.text ?? "")
          .join("");
        if (t) texts.push(t);
      }
    }

    return {
      content: toolCalls.length ? null : texts.join("\n") || null,
      toolCalls,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractRetryDelay(error: unknown): number | null {
    if (error && typeof error === "object" && "status" in error) {
      const err = error as { status?: number; message?: string };
      if (err.status === 429 && err.message) {
        const match = err.message.match(/retry in\s+([\d.]+)s?/i);
        if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
      }
    }
    return null;
  }

  async chat(
    messages: ChatMessage[],
    options?: { tools?: ToolDefinition[] }
  ): Promise<ChatResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const model = this.getModel();

    const attempt = async (retriesLeft: number): Promise<ChatResult> => {
      try {
        const interaction = await this.ai.interactions.create({
          model,
          input: this.toSteps(messages) as never,
          system_instruction: system,
          tools: options?.tools?.map((t) => this.toFunctionTool(t)) as never,
          store: false,
        });

        const steps = (interaction.steps ?? []) as GeminiStep[];
        this.rawTurns.push(steps);
        return this.fromSteps(steps);
      } catch (error) {
        const delay = this.extractRetryDelay(error);
        if (delay && retriesLeft > 0) {
          console.warn(`[gemini] 429 recibido, reintentando en ${delay}ms... (quedan ${retriesLeft})`);
          await this.sleep(delay);
          return attempt(retriesLeft - 1);
        }
        throw error;
      }
    };

    return attempt(2);
  }
}
