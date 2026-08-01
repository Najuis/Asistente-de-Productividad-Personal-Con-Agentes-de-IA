import type { ChatMessage, ChatResult, LLMProvider } from "./types.js";

const EXAMPLES: Record<string, string> = {
  recordar: "📌 Recordatorio guardado: te lo recordaré cuando corresponda.",
  nota: "📝 Nota guardada correctamente.",
  listar: "📋 Estas son tus notas y recordatorios.",
};

export class MockProvider implements LLMProvider {
  readonly name = "mock";

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const text = last?.content.toLowerCase() ?? "";

    if (/recordar|recuerda|recordatorio/.test(text)) {
      return { content: EXAMPLES.recordar };
    }
    if (/nota|apunta|guardar/.test(text)) {
      return { content: EXAMPLES.nota };
    }
    if (/listar|lista|qué tengo|tareas/.test(text)) {
      return { content: EXAMPLES.listar };
    }
    return {
      content: `🤖 [Mock] He recibido tu mensaje. Conecta un proveedor real (OPENAI_API_KEY o Ollama) para respuestas inteligentes.`,
    };
  }
}
