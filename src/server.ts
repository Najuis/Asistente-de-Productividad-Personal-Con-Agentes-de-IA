import http from "node:http";
import { createProvider } from "./providers/index.js";
import { Orchestrator } from "./orchestrator/orchestrator.js";
import { getConfig, verifyPassword } from "./config.js";
import { logActivity, getRecentActivity } from "./activity.js";

const port = Number(process.env.PORT ?? 3000);

const provider = createProvider();
const orchestrator = new Orchestrator(provider);

const ADMIN_TOKENS = new Map<string, number>();

function makeToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function checkAuth(token: string | undefined): boolean {
  if (!token) return false;
  const expiry = ADMIN_TOKENS.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    ADMIN_TOKENS.delete(token);
    return false;
  }
  ADMIN_TOKENS.set(token, Date.now() + 30 * 60 * 1000);
  return true;
}

function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]).trim();
  return req.socket.remoteAddress ?? "unknown";
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function serveHtml(res: http.ServerResponse, html: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

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
  let clientId = localStorage.getItem('clientId') || Math.random().toString(36).slice(2);
  localStorage.setItem('clientId', clientId);
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
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId },
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

const ADMIN_PAGE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Consola Admin</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 16px; }
  h1 { font-size: 1.3rem; margin: 0 0 16px; }
  .card { background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
  label { font-size: 0.85rem; color: #94a3b8; }
  select, input[type=password], input[type=text] { padding: 8px 12px; border-radius: 8px; border: none; background: #0f172a; color: #e2e8f0; min-width: 200px; }
  button { padding: 8px 16px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .status { font-size: 0.85rem; color: #94a3b8; margin-top: 8px; }
  .online { color: #22c55e; }
  .offline { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #1e293b; }
  th { color: #94a3b8; font-weight: 600; }
  tr:hover { background: #111827; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .dot.online { background: #22c55e; }
  .dot.offline { background: #ef4444; }
  .login-form { max-width: 360px; margin: 60px auto; background: #1e293b; padding: 24px; border-radius: 12px; }
  .login-form h2 { margin: 0 0 16px; }
  .login-form .row { flex-direction: column; align-items: stretch; }
</style>
</head>
<body>
<div id="login" class="login-form" style="display:none;">
  <h2>🔐 Acceso Admin</h2>
  <div class="row">
    <input type="password" id="pwd" placeholder="Contraseña" autocomplete="current-password">
    <button id="btnLogin">Entrar</button>
  </div>
  <div id="loginErr" style="color:#ef4444;margin-top:8px;display:none;"></div>
</div>
<div id="panel" style="display:none;">
  <h1>⚙️ Consola de Administración</h1>
  <div class="card">
    <div class="row">
      <label>Modelo actual:</label>
      <strong id="currentModel">—</strong>
      <label>Cambiar a:</label>
      <select id="modelSelect"></select>
      <button id="btnModel">Aplicar</button>
    </div>
    <div class="status" id="modelStatus"></div>
  </div>
  <div class="card">
    <div class="row" style="justify-content:space-between;">
      <span>Sesiones activas (actualiza cada 4s)</span>
      <button id="btnRefresh">Actualizar</button>
    </div>
    <table>
      <thead><tr><th>Fuente</th><th>Identidad</th><th>Estado</th><th>Msgs</th><th>Última actividad</th></tr></thead>
      <tbody id="sessions"></tbody>
    </table>
  </div>
</div>
<script>
  const TOKEN_KEY = 'adminToken';
  const login = document.getElementById('login');
  const panel = document.getElementById('panel');
  const pwd = document.getElementById('pwd');
  const btnLogin = document.getElementById('btnLogin');
  const loginErr = document.getElementById('loginErr');
  const currentModel = document.getElementById('currentModel');
  const modelSelect = document.getElementById('modelSelect');
  const btnModel = document.getElementById('btnModel');
  const modelStatus = document.getElementById('modelStatus');
  const sessionsBody = document.getElementById('sessions');
  const btnRefresh = document.getElementById('btnRefresh');

  const MODELS = [
    { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (≈30 RPM gratis)' },
    { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (≈30 RPM gratis)' },
    { id: 'gemini-3.6-flash', label: 'gemini-3.6-flash (≈20 RPM gratis)' },
    { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash (≈15 RPM gratis)' },
    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (≈15 RPM gratis)' },
    { id: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (≈30 RPM gratis)' },
    { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash (≈15 RPM gratis)' },
    { id: 'gemini-flash-latest', label: 'gemini-flash-latest (alias)' },
    { id: 'gemini-flash-lite-latest', label: 'gemini-flash-lite-latest (alias)' },
  ];

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async function api(path, opts = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401) { clearToken(); showLogin(); throw new Error('no auth'); }
    return res;
  }

  function showLogin() { panel.style.display = 'none'; login.style.display = 'block'; }
  function showPanel() { login.style.display = 'none'; panel.style.display = 'block'; loadStatus(); loadSessions(); }

  btnLogin.onclick = async () => {
    loginErr.style.display = 'none';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd.value })
      });
      if (!res.ok) throw new Error('bad');
      const data = await res.json();
      setToken(data.token);
      showPanel();
    } catch {
      loginErr.textContent = 'Contraseña incorrecta';
      loginErr.style.display = 'block';
    }
  };

  async function loadStatus() {
    try {
      const res = await api('/api/admin/status');
      const data = await res.json();
      currentModel.textContent = data.model;
      modelSelect.innerHTML = '';
      data.availableModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.label;
        if (m.id === data.model) opt.selected = true;
        modelSelect.appendChild(opt);
      });
    } catch (e) { console.error(e); }
  }

  btnModel.onclick = async () => {
    btnModel.disabled = true;
    modelStatus.textContent = 'Cambiando...';
    try {
      const res = await api('/api/admin/model', {
        method: 'POST',
        body: JSON.stringify({ model: modelSelect.value })
      });
      if (res.ok) {
        modelStatus.textContent = '✅ Modelo cambiado a ' + modelSelect.value;
        loadStatus();
      } else {
        const data = await res.json();
        modelStatus.textContent = '❌ ' + (data.error || 'Error');
      }
    } catch (e) {
      modelStatus.textContent = '❌ ' + e.message;
    }
    btnModel.disabled = false;
  };

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function loadSessions() {
    try {
      const res = await api('/api/admin/status');
      const data = await res.json();
      sessionsBody.innerHTML = '';
      if (!data.sessions?.length) {
        sessionsBody.innerHTML = '<tr><td colspan=5 style="color:#94a3b8;text-align:center;">Sin actividad reciente</td></tr>';
        return;
      }
      for (const s of data.sessions) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + s.source + '</td>' +
          '<td>' + (s.name || s.id) + '</td>' +
          '<td><span class="dot ' + (s.online ? 'online' : 'offline') + '"></span>' + (s.online ? 'Conectado' : 'Inactivo') + '</td>' +
          '<td>' + s.count + '</td>' +
          '<td>' + fmtTime(s.last) + '</td>';
        sessionsBody.appendChild(tr);
      }
    } catch (e) { console.error(e); }
  }

  btnRefresh.onclick = loadSessions;
  setInterval(loadSessions, 4000);

  if (getToken()) showPanel(); else showLogin();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;
  const clientIp = getClientIp(req);
  const clientId = req.headers["x-client-id"] as string | undefined;

  if (method === "POST" && path === "/api/admin/login") {
    const body = await parseBody(req) as { password?: string };
    const cfg = getConfig();
    if (!cfg.adminPasswordHash) {
      json(res, 500, { error: "Admin no configurado: falta ADMIN_PASSWORD en .env" });
      return;
    }
    const ok = await verifyPassword(body.password ?? "", cfg.adminPasswordHash);
    if (!ok) {
      json(res, 401, { error: "Contraseña incorrecta" });
      return;
    }
    const token = makeToken();
    ADMIN_TOKENS.set(token, Date.now() + 30 * 60 * 1000);
    json(res, 200, { token });
    return;
  }

  if (path === "/admin" && method === "GET") {
    serveHtml(res, ADMIN_PAGE);
    return;
  }

  if (path.startsWith("/api/admin/") && method === "GET") {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!checkAuth(token)) { json(res, 401, { error: "No autorizado" }); return; }
    if (path === "/api/admin/status") {
      const cfg = getConfig();
      const entries = getRecentActivity(200);
      const now = Date.now();
      const sessionsMap = new Map<string, { source: string; id: string; name?: string; ip?: string; count: number; last: number }>();
      for (const e of entries) {
        const key = e.source + ":" + e.id;
        const cur = sessionsMap.get(key);
        if (!cur || e.ts > cur.last) {
          sessionsMap.set(key, {
            source: e.source,
            id: e.id,
            name: e.name,
            ip: e.ip,
            count: (cur?.count ?? 0) + 1,
            last: e.ts,
          });
        }
      }
      const sessions = Array.from(sessionsMap.values())
        .map(s => ({ ...s, online: now - s.last < 120000 }))
        .sort((a, b) => b.last - a.last);
      const availableModels = [
        { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite (≈30 RPM gratis)" },
        { id: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite (≈30 RPM gratis)" },
        { id: "gemini-3.6-flash", label: "gemini-3.6-flash (≈20 RPM gratis)" },
        { id: "gemini-3.5-flash", label: "gemini-3.5-flash (≈15 RPM gratis)" },
        { id: "gemini-2.5-flash", label: "gemini-2.5-flash (≈15 RPM gratis)" },
        { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite (≈30 RPM gratis)" },
        { id: "gemini-2.0-flash", label: "gemini-2.0-flash (≈15 RPM gratis)" },
        { id: "gemini-flash-latest", label: "gemini-flash-latest (alias)" },
        { id: "gemini-flash-lite-latest", label: "gemini-flash-lite-latest (alias)" },
      ];
      json(res, 200, { model: cfg.model, availableModels, sessions });
      return;
    }
  }

  if (path === "/api/admin/model" && method === "POST") {
    const token = req.headers["authorization"]?.replace("Bearer ", "");
    if (!checkAuth(token)) { json(res, 401, { error: "No autorizado" }); return; }
    const body = await parseBody(req) as { model?: string };
    if (!body.model) { json(res, 400, { error: "model requerido" }); return; }
    import("./config.js").then(m => { m.setModelConfig(body.model!); });
    json(res, 200, { ok: true, model: body.model });
    return;
  }

  if (method === "GET" && path === "/health") {
    json(res, 200, { status: "ok", provider: provider.name, model: getConfig().model });
    return;
  }

  if (method === "POST" && path === "/api/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { message } = JSON.parse(body) as { message?: string };
      if (!message?.trim()) {
        json(res, 400, { error: "message es obligatorio" });
        return;
      }
      if (clientId) {
        logActivity({
          ts: Date.now(),
          source: "web",
          id: clientId,
          ip: clientIp,
          intent: "chat",
          msgPreview: message.slice(0, 80),
        });
      }
      const { intent, reply } = await orchestrator.handle(message.trim());
      json(res, 200, { intent, reply });
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
    return;
  }

  if (method === "GET" && path === "/") {
    serveHtml(res, PAGE);
    return;
  }

  json(res, 404, { error: "No encontrado" });
});

server.listen(port, () => {
  console.log(`Asistente web en http://localhost:${port} (proveedor: ${provider.name}, modelo: ${getConfig().model})`);
  console.log(`Admin en http://localhost:${port}/admin`);
});