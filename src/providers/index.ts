import "dotenv/config";
import type { LLMProvider } from "./types.js";
import { OpenAIProvider } from "./openai.js";
import { OllamaProvider } from "./ollama.js";
import { MockProvider } from "./mock.js";

export type ProviderName = "openai" | "ollama" | "mock";

export function createProvider(name?: ProviderName, model?: string): LLMProvider {
  const providerName = name ?? (process.env.LLM_PROVIDER as ProviderName) ?? "mock";

  switch (providerName) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada");
      return new OpenAIProvider(apiKey, model ?? process.env.OPENAI_MODEL);
    }
    case "ollama":
      return new OllamaProvider(model ?? process.env.OLLAMA_MODEL);
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Proveedor desconocido: ${providerName}`);
  }
}
