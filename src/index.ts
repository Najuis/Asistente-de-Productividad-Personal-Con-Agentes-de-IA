import { createProvider } from "./providers/index.js";
import { Orchestrator } from "./orchestrator/orchestrator.js";
import { startChatbot } from "./chatbot/cli.js";

const provider = createProvider();
const orchestrator = new Orchestrator(provider);

console.log(`Proveedor IA: ${provider.name}`);

if (process.argv.includes("--once")) {
  const message = process.argv.slice(2).filter((a) => !a.startsWith("--"))[0];
  if (!message) {
    console.error("Uso: npm run dev -- --once 'tu mensaje'");
    process.exit(1);
  }
  const { intent, reply } = await orchestrator.handle(message);
  console.log(`[${intent}] ${reply}`);
} else {
  await startChatbot(orchestrator);
}
