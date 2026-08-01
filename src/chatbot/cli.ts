import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Orchestrator } from "../orchestrator/orchestrator.js";

export async function startChatbot(orchestrator: Orchestrator): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log("🤖 Asistente de productividad listo. Escribe 'salir' para terminar.\n");

  while (true) {
    const input = await rl.question("Tú > ");
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (/^(salir|exit|quit)$/i.test(trimmed)) break;

    try {
      const { intent, reply } = await orchestrator.handle(trimmed);
      console.log(`Asistente [${intent}] > ${reply}\n`);
    } catch (err) {
      console.error(`❌ Error: ${(err as Error).message}\n`);
    }
  }

  rl.close();
  console.log("👋 ¡Hasta luego!");
}
