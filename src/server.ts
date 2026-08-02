import http from "node:http";
import { createProvider } from "./providers/index.js";
import { Orchestrator } from "./orchestrator/orchestrator.js";

const port = Number(process.env.PORT ?? 3000);

const provider = createProvider();
const orchestrator = new Orchestrator(provider);

const PAGE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Asistente de Productividad</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; display: flex; flex-direction: column; height: 100vh; }
  header { padding: 12px 16px; background: #1e293b; font-weight: 600; }
  #chat { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
  .msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; white-space: pre-wrap; word-break: break-word; }
  .user { align-self: flex-end; background: #2563eb; }
  .bot { align-self: flex-start; background: #334155; }
  .bot small { color: #94a3b8; }
  form { display: flex; gap: 8px; padding: 12px 16px; background: #1e293b; }
  input { flex: 1; padding: 10px 12px; border-radius: 8px; border: none; background: #0f172a; color: #e2e8f0; }
  button { padding: 10px 16px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; }
</style>
</head>
<body>
<header>🤖 Asistente de Productividad</header>
<div id="chat"></div>
<form id="form">
  <input id="input" placeholder="Escribe tu mensaje..." autocomplete="off">
  <button id="send">Enviar</button>
</form>
<script>
  const chat = document.getElementById('chat');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const send = document.getElementById('send');
  function add(text, who) {
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    add(msg, 'user');
    input.value = '';
    send.disabled = true;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      add(data.reply, 'bot');
    } catch {
      add('Error de conexión con el servidor.', 'bot');
    }
    send.disabled = false;
    input.focus();
  });
  input.focus();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", provider: provider.name }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { message } = JSON.parse(body) as { message?: string };
      if (!message?.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "message es obligatorio" }));
        return;
      }
      const { intent, reply } = await orchestrator.handle(message.trim());
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ intent, reply }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "No encontrado" }));
});

server.listen(port, () => {
  console.log(`Asistente web en http://localhost:${port} (proveedor: ${provider.name})`);
});
