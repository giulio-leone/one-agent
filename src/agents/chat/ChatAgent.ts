/**
 * ChatAgent - AI SDK v6 ToolLoopAgent Implementation
 *
 * Nuovo agent chat unificato basato su AI SDK v6 ToolLoopAgent.
 * Sostituisce la vecchia implementazione in lib-ai-agents/chat-agent.ts
 *
 * PRINCIPI:
 * - KISS: Usa direttamente ToolLoopAgent senza wrapper complessi
 * - DRY: Logica comune in prepareCall, no duplicazioni
 * - SOLID: Single Responsibility - solo orchestrazione chat
 *
 * FEATURES:
 * - Call options dinamiche (userId, isAdmin, context)
 * - Tool approval configurabile (default: auto-approve)
 * - MCP tools integration
 * - Persistenza messaggi via onMessage callback
 */

import { xai } from '@ai-sdk/xai';
import { ToolLoopAgent, type Tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { AIModelService } from '@giulio-leone/lib-ai';

// ============================================================================
// Types
// ============================================================================

/**
 * Schema per le call options dinamiche del ChatAgent
 */
export const chatCallOptionsSchema = z.object({
  /** User ID per context e autorizzazione */
  userId: z.string(),
  /** Se l'utente è admin */
  isAdmin: z.boolean().optional().default(false),
  /** Conversation ID (opzionale per nuove conversazioni) */
  conversationId: z.string().optional(),
  /** Profilo utente per personalizzazione */
  userProfile: z
    .object({
      weight: z.number().nullish(),
      height: z.number().nullish(),
      age: z.number().nullish(),
      gender: z.string().nullish(),
      activityLevel: z.string().nullish(),
    })
    .optional(),
  /** Dominio specifico (nutrition, workout, etc) */
  domain: z
    .enum(['general', 'nutrition', 'workout', 'analytics', 'coach', 'flight'])
    .optional()
    .default('general'),
  /** Tier del modello */
  tier: z.enum(['fast', 'balanced', 'quality']).optional().default('balanced'),
  /** Override modello (solo admin) */
  modelOverride: z
    .object({
      provider: z.enum(['openrouter', 'anthropic', 'openai', 'google', 'xai', 'minimax']),
      model: z.string(),
    })
    .optional(),
  /** Abilita reasoning esteso */
  reasoning: z.boolean().optional().default(false),
  /** Effort del reasoning */
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

export type ChatCallOptions = z.infer<typeof chatCallOptionsSchema>;

/**
 * Provider supportati
 * Nota: 'minimax' usa l'API Anthropic-compatibile di MiniMax
 */
export type ChatProvider = 'openrouter' | 'anthropic' | 'openai' | 'google' | 'xai' | 'minimax';

// ============================================================================
// Constants
// ============================================================================

/**
 * Modelli default per tier
 */
// Modelli default per tier rimosse in favore della configurazione Admin DB

/**
 * System prompt base per il ChatAgent
 */
const BASE_SYSTEM_PROMPT = `Sei onecoach AI, un assistente fitness e nutrizione intelligente e personalizzato.

RUOLO:
- Aiuti gli utenti a raggiungere i loro obiettivi di fitness e nutrizione
- Fornisci consigli basati su evidenze scientifiche
- Sei empatico, motivante e professionale

CAPACITÀ:
- Puoi creare piani nutrizionali personalizzati
- Puoi generare programmi di allenamento
- Puoi analizzare progressi e suggerire miglioramenti
- Puoi gestire alimenti ed esercizi nel database (se admin)

LINEE GUIDA:
- Rispondi sempre in italiano
- Sii conciso ma completo
- Chiedi chiarimenti se necessario prima di procedere
- Usa i tool disponibili quando appropriato
`;

// ============================================================================
// Model Provider Factory
// ============================================================================

/**
 * Language model creation is now handled by AIModelService
 */

// ============================================================================
// ChatAgent Factory
// ============================================================================

export interface CreateChatAgentOptions {
  /** Tools da rendere disponibili all'agent */
  tools?: Record<string, Tool>;
  /** Abilita auto-approval per tutti i tool (default: true) */
  autoApproveTools?: boolean;
  /** System prompt aggiuntivo */
  additionalInstructions?: string;
}

/**
 * Crea un ChatAgent configurato per onecoach
 *
 * @example
 * ```typescript
 * const agent = createChatAgent({
 *   tools: mcpTools,
 *   autoApproveTools: true,
 * });
 *
 * const result = await agent.generate({
 *   prompt: 'Crea un piano nutrizionale',
 *   options: {
 *     userId: 'user_123',
 *     isAdmin: false,
 *     tier: 'balanced',
 *   },
 * });
 * ```
 */
export function createChatAgent(options: CreateChatAgentOptions = {}) {
  const { tools = {}, autoApproveTools = true, additionalInstructions = '' } = options;

  // Prepara tools con approval configurabile
  const agentTools: Record<string, Tool> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    if (autoApproveTools) {
      // Auto-approve: non richiede approvazione utente
      agentTools[name] = toolDef;
    } else {
      // Manual approval: richiede conferma utente
      // Per ora manteniamo auto-approve hardcoded come richiesto
      agentTools[name] = {
        ...toolDef,
        needsApproval: true,
      } as Tool;
    }
  }

  // Crea l'agent con ToolLoopAgent
  // Note: model is set dynamically in prepareCall via AIModelService
  // We use xai as a placeholder here since model is overridden per-call
  const agent = new ToolLoopAgent({
    // Model placeholder (will be overwritten by prepareCall with AIModelService)
    model: xai('grok-2-1212'),

    // Schema per call options tipizzate
    callOptionsSchema: chatCallOptionsSchema,

    // Instructions base
    instructions: BASE_SYSTEM_PROMPT + additionalInstructions,

    // Tools disponibili
    tools: agentTools as ToolSet,

    // Tool choice: auto per default
    toolChoice: 'auto',

    // prepareCall per configurazione dinamica
    prepareCall: async ({ options, ...settings }: { options: ChatCallOptions; [key: string]: unknown }) => {
      // Get config from AIModelService (Standardized Model Selection)
      // This respects admin dashboard settings for CHAT_GENERATION
      const config = await AIModelService.getFeatureModelConfig(
        'chat',
        options.modelOverride?.model
      );

      // Costruisci instructions dinamiche
      let dynamicInstructions = settings.instructions || '';

      // Aggiungi context utente
      dynamicInstructions += `\n\nCONTEXT UTENTE:
- User ID: ${options.userId}
- Admin: ${options.isAdmin ? 'Sì' : 'No'}
- Dominio corrente: ${options.domain}`;

      // Aggiungi profilo se disponibile
      if (options.userProfile) {
        const profile = options.userProfile;
        dynamicInstructions += `\n\nPROFILO UTENTE:`;
        if (profile.weight) dynamicInstructions += `\n- Peso: ${profile.weight} kg`;
        if (profile.height) dynamicInstructions += `\n- Altezza: ${profile.height} cm`;
        if (profile.age) dynamicInstructions += `\n- Età: ${profile.age} anni`;
        if (profile.gender) dynamicInstructions += `\n- Genere: ${profile.gender}`;
        if (profile.activityLevel)
          dynamicInstructions += `\n- Livello attività: ${profile.activityLevel}`;
      }

      // Aggiungi istruzioni specifiche per dominio
      if (options.domain !== 'general') {
        dynamicInstructions += `\n\nDOMINIO ATTIVO: ${options.domain.toUpperCase()}
Focus su risposte relative a questo dominio. Usa i tool appropriati quando necessario.`;
      }

      // Aggiungi istruzioni per tool
      if (Object.keys(agentTools).length > 0) {
        dynamicInstructions += `\n\nTOOL DISPONIBILI:
Hai accesso a ${Object.keys(agentTools).length} tool. Usali quando appropriato per:
- Cercare alimenti ed esercizi
- Creare/modificare contenuti (se admin)
- Ottenere informazioni dal database

IMPORTANTE: Dopo ogni chiamata tool, fornisci sempre una risposta testuale all'utente.`;
      }

      return {
        model: config.model,
        instructions: dynamicInstructions as string,
        maxOutputTokens: config.maxTokens,
        // Common provider options from standardized config
        providerOptions: {
          ...config.providerOptions,
          ...(options.reasoning && {
            openai: {
              reasoningEffort: options.reasoningEffort,
            },
          }),
        },
      };
    },
  });

  return agent;
}

// ============================================================================
// Singleton ChatAgent (per uso con MCP tools caricati dinamicamente)
// ============================================================================

let _chatAgentInstance: ReturnType<typeof createChatAgent> | null = null;

/**
 * Ottiene o crea l'istanza singleton del ChatAgent
 * Utile quando i tools vengono caricati dinamicamente (es. MCP)
 */
export function getChatAgent(options?: CreateChatAgentOptions) {
  if (!_chatAgentInstance || options) {
    _chatAgentInstance = createChatAgent(options);
  }
  return _chatAgentInstance;
}

/**
 * Reset dell'istanza (utile per testing)
 */
export function resetChatAgent() {
  _chatAgentInstance = null;
}

// ============================================================================
// Export Types
// ============================================================================

export type ChatAgent = ReturnType<typeof createChatAgent>;
