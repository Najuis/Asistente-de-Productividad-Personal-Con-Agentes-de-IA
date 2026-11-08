import type { LLMProvider } from "../providers/types.js";
import { AssistantAgent } from "../agents/assistant.js";

export type Intent = "assistant" | "chat";

interface ConversationContext {
  messages: Array<{ role: string; content: string; timestamp: number }>;
  lastActivity: number;
}

export class Orchestrator {
  private assistant: AssistantAgent;
  private context: Map<string, ConversationContext> = new Map();
  private readonly MAX_CONTEXT_MESSAGES = 5;
  private readonly CONTEXT_TTL_MS = 30 * 60 * 1000; // 30 minutos

  constructor(private provider: LLMProvider) {
    this.assistant = new AssistantAgent(provider);
  }

  /**
   * Obtiene la fecha y hora actual formateada en español
   */
  private getCurrentDateTime(): string {
    const now = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const dateString = now.toLocaleDateString('es-ES', dateOptions);
    const timeString = now.toLocaleTimeString('es-ES', timeOptions);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return `${dateString} - ${timeString} (${timeZone})`;
  }

  /**
   * Detecta intención con análisis más profundo y keywords expandidas
   */
  detectIntent(message: string): Intent {
    const text = message
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    // Keywords expandidas y más específicas para herramientas
    const toolKeywords = {
      // Notas y recordatorios
      notes: /nota|apunt|guardar|anotar|escribir|memorando|memo/,
      reminders: /recordar|recuerd|alarma|aviso|notificacion|notifica/,
      
      // Control de sistema
      system: /sistema|info|informacion|especificaciones|hardware|cpu|ram|memoria|disco|almacenamiento/,
      processes: /proceso|procesos|task|taskmanager|administrador|tareas|running|ejecutando/,
      kill: /matar|terminar|cerrar|kill|end|finalizar|detener/,
      
      // Archivos y directorios
      files: /archivo|archivos|file|files|leer|abrir|ver|contenido|texto|documento/,
      directory: /carpeta|carpetas|directorio|directorios|folder|folders|lista|listar|dir|ls/,
      
      // Control de aplicaciones
      apps: /abre|abrir|launch|ejecutar|iniciar|programa|aplicacion|app|software/,
      url: /url|link|enlace|pagina|web|sitio|navegador|browser|http|www/,
      
      // Multimedia y capturas
      screenshot: /captura|pantalla|screenshot|foto|imagen|screen|capture/,
      volume: /volumen|sonido|audio|speaker|mute|silencio|subir|bajar volumen/,
      brightness: /brillo|brightness|pantalla|screen|luz|iluminacion/,
      
      // Red y conectividad
      network: /internet|red|network|conexion|conectar|wifi|ethernet|ping|connect/,
      
      // Control de energía
      power: /apaga|apagar|shutdown|power|off|reinicia|reiniciar|restart|reboot|logout|cerrar sesion|suspend|hibernar/,
      
      // Utilidades
      help: /ayuda|help|que puedes|comandos|commands|features|capacidades|funciones/
    };

    // Verificar cada categoría de herramientas
    for (const [category, regex] of Object.entries(toolKeywords)) {
      if (regex.test(text)) {
        console.log(`[Orchestrator] Intencion detectada: ${category} (patron: ${regex.source})`);
        return "assistant";
      }
    }

    // Si no coincide con ninguna herramienta, es chat normal
    return "chat";
  }

  /**
   * Gestiona el contexto de conversación por usuario
   */
  private getContext(userId: string): ConversationContext {
    const ctx = this.context.get(userId);
    const now = Date.now();

    // Si no existe o expiró, crear nuevo contexto
    if (!ctx || (now - ctx.lastActivity) > this.CONTEXT_TTL_MS) {
      const newCtx: ConversationContext = {
        messages: [],
        lastActivity: now
      };
      this.context.set(userId, newCtx);
      return newCtx;
    }

    return ctx;
  }

  /**
   * Agrega mensaje al contexto y limpia antiguos
   */
  private addToContext(userId: string, role: string, content: string): void {
    const ctx = this.getContext(userId);
    
    ctx.messages.push({
      role,
      content: content.slice(0, 500), // Limitar longitud
      timestamp: Date.now()
    });

    // Mantener solo los últimos N mensajes
    if (ctx.messages.length > this.MAX_CONTEXT_MESSAGES) {
      ctx.messages = ctx.messages.slice(-this.MAX_CONTEXT_MESSAGES);
    }

    ctx.lastActivity = Date.now();
  }

  /**
   * Limpia contextos expirados (llamar periódicamente)
   */
  cleanupExpiredContexts(): void {
    const now = Date.now();
    for (const [userId, ctx] of this.context.entries()) {
      if ((now - ctx.lastActivity) > this.CONTEXT_TTL_MS) {
        this.context.delete(userId);
        console.log(`[Orchestrator] Contexto expirado limpiado para usuario: ${userId}`);
      }
    }
  }

  /**
   * Construye system prompt profesional y consciente
   */
  private buildSystemPrompt(isAssistantMode: boolean = false): string {
    const currentDateTime = this.getCurrentDateTime();
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (isAssistantMode) {
      // Modo asistente con herramientas
      return `Eres un asistente de productividad personal de nivel empresarial con control total del sistema operativo Windows.

**CONTEXTO TEMPORAL ACTUAL:**
- Fecha y hora exacta: ${currentDateTime}
- Hoy es: ${today}
- Mañana será: ${tomorrow}

**TUS CAPACIDADES:**
1. Gestión de conocimiento: Guardar notas, recordatorios y tareas con fechas específicas
2. Control de sistema: Abrir aplicaciones, gestionar procesos, archivos y directorios
3. Multimedia: Capturas de pantalla, control de volumen y brillo
4. Conectividad: Verificar estado de red e internet
5. Energía: Apagar, reiniciar o cerrar sesión (SOLO con confirmación explícita)

**REGLAS CRÍTICAS:**
- Responde SIEMPRE en español, de forma clara, concisa y profesional
- Para recordatorios sin fecha específica, sugiere automáticamente mañana (${tomorrow}) a las 09:00
- Acciones destructivas (kill_process, shutdown_pc) requieren confirmación EXPLÍCITA del usuario ("sí", "confirma", "adelante")
- Ejecuta CADA herramienta una sola vez y confirma el resultado inmediatamente
- Si una herramienta falla, informa el error de forma clara y sugiere alternativas
- NUNCA inventes información sobre el estado del sistema - usa las herramientas para obtener datos reales

**FORMATO DE RESPUESTA:**
- Sé directo y evita redundancias
- Usa emojis solo cuando sea relevante (📝 📌  🔧 ⚠️)
- Proporciona información accionable y específica`;

    } else {
      // Modo chat conversacional
      return `Eres un asistente de productividad personal inteligente, analítico y profesional.

**CONTEXTO TEMPORAL ACTUAL:**
- Fecha y hora exacta: ${currentDateTime}
- Zona horaria del sistema: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

**TU ROL:**
- Responder preguntas de forma precisa, objetiva y fundamentada
- Proporcionar información actualizada y verificable
- Mantener un tono profesional pero accesible
- Ser consciente del tiempo y contexto de la conversación

**CAPACIDADES CONVERSACIONALES:**
- Responder sobre cualquier tema con profundidad analítica
- Recordar el contexto de la conversación actual
- Adaptar el nivel de detalle según la complejidad de la pregunta
- Identificar cuando el usuario necesita ayuda con notas, recordatorios o control del sistema y ofrecerlo proactivamente

**REGLAS DE RESPUESTA:**
- SIEMPRE responde en español
- Si preguntas por fecha/hora, usa EXACTAMENTE la información temporal proporcionada arriba
- Sé conciso pero completo - evita respuestas vagas como "insertar fecha"
- Si no sabes algo, admítelo honestamente en lugar de inventar
- Proporciona ejemplos concretos cuando sea útil
- Mantén coherencia con mensajes anteriores de la conversación

**EJEMPLOS DE RESPUESTAS CORRECTAS:**
✅ "Hoy es lunes 8 de noviembre de 2026, son las 14:30 horas."
✅ "Puedo ayudarte a guardar esa nota. ¿Qué quieres que anote?"
❌ "Hoy es [insertar fecha]"
❌ "No tengo información sobre la fecha actual"`;
    }
  }

  /**
   * Manejo principal de mensajes - Versión robusta y analítica
   */
  async handle(message: string, userId: string = "default"): Promise<{ intent: Intent; reply: string }> {
    const startTime = Date.now();
    const intent = this.detectIntent(message);
    
    console.log(`[Orchestrator] Mensaje recibido: "${message.slice(0, 50)}..." | Usuario: ${userId} | Intencion: ${intent}`);

    try {
      if (intent === "assistant") {
        // Modo asistente con herramientas
        const { content } = await this.assistant.run(message);
        const duration = Date.now() - startTime;
        console.log(`[Orchestrator] Respuesta asistente en ${duration}ms: "${content.slice(0, 50)}..."`);
        return { intent, reply: content };
      }

      // Modo chat conversacional con contexto
      const ctx = this.getContext(userId);
      
      // Agregar mensaje del usuario al contexto
      this.addToContext(userId, "user", message);

      // Construir mensajes con contexto histórico
      const messages = [
        { role: "system" as const, content: this.buildSystemPrompt(false) },
        ...ctx.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: message }
      ];

      const result = await this.provider.chat(messages);
      const reply = result.content ?? "No tengo respuesta en este momento.";

      // Agregar respuesta al contexto
      this.addToContext(userId, "assistant", reply);

      const duration = Date.now() - startTime;
      console.log(`[Orchestrator] Respuesta chat en ${duration}ms | Tokens contexto: ${ctx.messages.length}`);

      return { intent, reply };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      console.error(`[Orchestrator] ERROR procesando mensaje: ${errorMessage}`);
      
      // Respuesta de fallback profesional
      return {
        intent,
        reply: `⚠️ Ocurrió un error procesando tu solicitud. Detalles: ${errorMessage}\n\nPor favor, intenta de nuevo o reformula tu pregunta.`
      };
    }
  }

  /**
   * Método para obtener estadísticas del orquestador
   */
  getStats(): { activeContexts: number; totalUsers: number } {
    return {
      activeContexts: this.context.size,
      totalUsers: this.context.size
    };
  }
}