import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Orchestrator } from "../orchestrator/orchestrator.js";

export async function startChatbot(orchestrator: Orchestrator): Promise<void> {
  // Forzar modo raw para mejor compatibilidad
  if (stdin.isTTY) {
    stdin.setRawMode(true);
  }

  const rl = readline.createInterface({ 
    input: stdin, 
    output: stdout,
    terminal: true,
    prompt: "Tú > "
  });

  console.log("🤖 Asistente de productividad listo. Escribe 'salir' para terminar.\n");
  
  // Mostrar prompt inicial
  rl.prompt();

  while (true) {
    let trimmed: string;
    try {
      const input = await rl.question("");
      trimmed = input.trim();
    } catch {
      break;
    }
    
    if (!trimmed) {
      rl.prompt();
      continue;
    }
    
    if (/^(salir|exit|quit)$/i.test(trimmed)) break;
    
    try {
      const { intent, reply } = await orchestrator.handle(trimmed);
      console.log(`Asistente [${intent}] > ${reply}\n`);
    } catch (err) {
      console.error(`❌ Error: ${(err as Error).message}\n`);
    }
    
    rl.prompt();
  }
  
  rl.close();
  console.log("👋 ¡Hasta luego!");
}