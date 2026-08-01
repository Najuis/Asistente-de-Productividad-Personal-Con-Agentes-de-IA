import type { LLMProvider } from "../providers/types.js";
import { AssistantAgent } from "../agents/assistant.js";

export type Intent = "assistant" | "chat";

export class Orchestrator {
  private assistant: AssistantAgent;

  constructor(private provider: LLMProvider) {
    this.assistant = new AssistantAgent(provider);
  }

  detectIntent(message: string): Intent {
    const text = message
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const needsTools =
      /nota|apunt|guardar|recordar|recordatorio|recuerd|tarea|lista|listar|que tengo|borrar|eliminar/.test(
        text
      );
    return needsTools ? "assistant" : "chat";
  }

  async handle(message: string): Promise<{ intent: Intent; reply: string }> {
    const intent = this.detectIntent(message);

    if (intent === "assistant") {
      const { content } = await this.assistant.run(message);
      return { intent, reply: content };
    }

    const reply = await this.provider.chat([
      {
        role: "system",
        content:
          "Eres un asistente de productividad. Responde en español, breve y amigable. Si el usuario quiere guardar notas, recordatorios o tareas, ofrécele hacerlo.",
      },
      { role: "user", content: message },
    ]);

    return { intent, reply: reply.content ?? "No tengo respuesta." };
  }
}
