/**
 * ChatAgent - AI SDK v6 ToolLoopAgent Implementation
 *
 * Agent chat unificato basato su AI SDK v6 ToolLoopAgent.
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

import type { Tool, ToolSet, SystemModelMessage } from 'ai';
import { z } from 'zod';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import type { MemoryInsight, MemoryPattern } from '@giulio-leone/lib-core';
import { buildProviderOptions } from '@giulio-leone/lib-ai';

import { logger } from '@giulio-leone/lib-shared';

// ============================================================================
// AI SDK v6 Imports (runtime verified)
// ============================================================================

// ToolLoopAgent is exported at runtime but TS may not see it
// due to verbatimModuleSyntax - we use require as fallback
let ToolLoopAgent: (typeof import('ai'))['ToolLoopAgent'] | undefined;
try {
  const aiModule: Partial<typeof import('ai')> = require('ai');
  ToolLoopAgent = aiModule.ToolLoopAgent;
} catch (e) {
  logger.error('[ChatAgent] Failed to load ToolLoopAgent:', e);
}

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
  isAdmin: z.boolean().default(false),
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
  domain: z.enum(['general', 'nutrition', 'workout', 'analytics', 'coach']).default('general'),
  /** Tier del modello */
  tier: z.enum(['fast', 'balanced', 'quality']).default('balanced'),
  /** Override modello (solo admin) */
  modelOverride: z
    .object({
      provider: z.enum(['openrouter', 'anthropic', 'openai', 'google', 'xai']),
      model: z.string(),
      /** Preferred provider for OpenRouter routing (from admin AI settings) */
      preferredProvider: z.string().nullish(),
    })
    .optional(),
  /** Abilita reasoning esteso */
  reasoning: z.boolean().default(false),
  /** Effort del reasoning */
  reasoningEffort: z.enum(['low', 'medium', 'high']).default('medium'),
});

export type ChatCallOptions = z.infer<typeof chatCallOptionsSchema>;

/**
 * Provider supportati
 */
export type ChatProvider = 'openrouter' | 'anthropic' | 'openai' | 'google' | 'xai';

/**
 * Configurazione modello per tier
 */
interface TierModelConfig {
  provider: ChatProvider;
  model: string;
  maxTokens: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Modelli default per tier
 */
const TIER_MODELS: Record<'fast' | 'balanced' | 'quality', TierModelConfig> = {
  fast: {
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-lite-001',
    maxTokens: 4096,
  },
  balanced: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4-20250514',
    maxTokens: 8192,
  },
  quality: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4-20250514',
    maxTokens: 16384,
  },
};

/**
 * System prompt base per il ChatAgent
 *
 * PRINCIPIO: Fornisce obiettivi e contesto, non prescrizioni metodologiche.
 * L'AI decide autonomamente approcci, tool, e strategie basandosi sulla sua conoscenza.
 */
const BASE_SYSTEM_PROMPT = `Sei onecoach AI, un assistente fitness e nutrizione intelligente e personalizzato.

RUOLO:
- Aiuti gli utenti a raggiungere i loro obiettivi di fitness e nutrizione
- Fornisci consigli basati su evidenze scientifiche e la tua conoscenza
- Sei empatico, motivante e professionale
- Hai autonomia nel decidere approcci, metodologie e strategie ottimali

CAPACITÀ:
- Puoi creare piani nutrizionali personalizzati (decidi autonomamente calcoli, distribuzione pasti, selezione alimenti)
- Puoi generare programmi di allenamento (decidi autonomamente split, volume, intensità, progressione)
- Puoi analizzare progressi e suggerire miglioramenti
- Puoi gestire alimenti ed esercizi nel database (se admin)

AUTONOMIA DECISIONALE:
- Scegli autonomamente quali tool usare per ogni task
- Decidi autonomamente metodologie e approcci (es. periodizzazione, calcolo macro, split training)
- Adatta strategie in base a contesto, obiettivi e vincoli dell'utente
- Non seguire prescrizioni rigide - usa la tua conoscenza per determinare soluzioni ottimali

LINEE GUIDA:
- Rispondi sempre in italiano
- Sii conciso ma completo
- Chiedi chiarimenti se necessario prima di procedere
- Usa i tool disponibili quando appropriato - scegli autonomamente quali e come combinarli
- Spiega le tue decisioni quando rilevante (trasparenza, non giustificazione)
`;

// ============================================================================
// Model Provider Factory
// ============================================================================

/**
 * Crea il language model per il provider specificato
 */
function createLanguageModel(provider: ChatProvider, modelId: string) {
  switch (provider) {
    case 'openrouter':
      return openrouter(modelId);
    case 'anthropic':
      return anthropic(modelId);
    case 'openai':
      return openai(modelId);
    case 'google':
      return google(modelId);
    case 'xai':
      return xai(modelId);
    default:
      return openrouter(modelId);
  }
}

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
  const { tools = {}, additionalInstructions = '' } = options;

  if (!ToolLoopAgent) {
    throw new Error('ToolLoopAgent not available - AI SDK v6 beta required');
  }

  // Crea l'agent con ToolLoopAgent
  const agent = new ToolLoopAgent({
    // Model default (verrà sovrascritto da prepareCall)
    model: createLanguageModel('openrouter', TIER_MODELS.balanced.model),

    // Schema per call options tipizzate
    callOptionsSchema: chatCallOptionsSchema,

    // Instructions base
    instructions: BASE_SYSTEM_PROMPT + additionalInstructions,

    // Tools disponibili
    tools: tools as ToolSet,

    // Tool choice: auto per default
    toolChoice: 'auto',

    // prepareCall per configurazione dinamica
    prepareCall: async ({
      options: callOpts,
      ...settings
    }: {
      options: ChatCallOptions;
      instructions?: string | SystemModelMessage | Array<SystemModelMessage>;
    }) => {
      // Determina modello da usare
      let provider: ChatProvider;
      let modelId: string;
      let maxTokens: number;

      if (callOpts.modelOverride && callOpts.isAdmin) {
        // Admin override
        provider = callOpts.modelOverride.provider;
        modelId = callOpts.modelOverride.model;
        maxTokens = 16384;
      } else {
        // Usa tier
        const tier = callOpts.tier as 'fast' | 'balanced' | 'quality';
        const tierConfig = TIER_MODELS[tier] ?? TIER_MODELS.balanced;
        provider = tierConfig.provider;
        modelId = tierConfig.model;
        maxTokens = tierConfig.maxTokens;
      }

      // Costruisci instructions dinamiche
      // Extract base instructions as string (settings.instructions may be string | SystemModelMessage | SystemModelMessage[])
      const baseInstructions =
        typeof settings.instructions === 'string' ? settings.instructions : '';
      let dynamicInstructions = baseInstructions;

      // Aggiungi context utente
      dynamicInstructions += `\n\nCONTEXT UTENTE:
- User ID: ${callOpts.userId}
- Admin: ${callOpts.isAdmin ? 'Sì' : 'No'}
- Dominio corrente: ${callOpts.domain}`;

      // Aggiungi profilo se disponibile
      if (callOpts.userProfile) {
        const profile = callOpts.userProfile;
        dynamicInstructions += `\n\nPROFILO UTENTE:`;
        if (profile.weight) dynamicInstructions += `\n- Peso: ${profile.weight} kg`;
        if (profile.height) dynamicInstructions += `\n- Altezza: ${profile.height} cm`;
        if (profile.age) dynamicInstructions += `\n- Età: ${profile.age} anni`;
        if (profile.gender) dynamicInstructions += `\n- Genere: ${profile.gender}`;
        if (profile.activityLevel)
          dynamicInstructions += `\n- Livello attività: ${profile.activityLevel}`;
      }

      // Aggiungi memoria utente per personalizzazione
      try {
        const { userMemoryService } = await import('@giulio-leone/lib-core');
        const memoryContext = await userMemoryService.getMemoryContext(callOpts.userId);

        if (
          memoryContext.relevantPatterns.length > 0 ||
          memoryContext.relevantInsights.length > 0
        ) {
          dynamicInstructions += `\n\nMEMORIA UTENTE (Pattern e Preferenze Apprese):`;

          if (memoryContext.relevantPatterns.length > 0) {
            dynamicInstructions += `\n\nPattern Identificati:`;
            memoryContext.relevantPatterns.slice(0, 5).forEach((pattern: MemoryPattern) => {
              dynamicInstructions += `\n- ${pattern.type}: ${pattern.description} (confidenza: ${(pattern.confidence * 100).toFixed(0)}%)`;
              if (pattern.suggestions && pattern.suggestions.length > 0) {
                dynamicInstructions += `\n  Suggerimenti: ${pattern.suggestions.slice(0, 2).join(', ')}`;
              }
            });
          }

          if (memoryContext.relevantInsights.length > 0) {
            dynamicInstructions += `\n\nInsights:`;
            memoryContext.relevantInsights.slice(0, 3).forEach((insight: MemoryInsight) => {
              dynamicInstructions += `\n- ${insight.category}: ${insight.insight}`;
            });
          }

          if (memoryContext.recommendations.length > 0) {
            dynamicInstructions += `\n\nRaccomandazioni:`;
            memoryContext.recommendations.slice(0, 3).forEach((rec) => {
              dynamicInstructions += `\n- ${rec.message}`;
            });
          }

          dynamicInstructions += `\n\nUsa queste informazioni per personalizzare le tue risposte e suggerimenti.`;
        }
      } catch (error) {
        // Non bloccare se la memoria non è disponibile
        logger.warn('[Chat Agent] Error loading user memory:', error);
      }

      // Aggiungi istruzioni specifiche per dominio
      if (callOpts.domain !== 'general') {
        dynamicInstructions += `\n\nDOMINIO ATTIVO: ${callOpts.domain.toUpperCase()}
Focus su risposte relative a questo dominio. 

AUTONOMIA: Decidi autonomamente:
- Quali tool usare e in quale ordine
- Quali metodologie/approcci adottare
- Come strutturare piani/programmi
- Come bilanciare obiettivi e vincoli

Non seguire prescrizioni rigide - usa la tua conoscenza per determinare soluzioni ottimali.`;
      }

      // Aggiungi istruzioni per tool
      const toolNames = Object.keys(tools);
      if (toolNames.length > 0) {
        const toolCategories = new Set(
          toolNames.map((name) => {
            if (name.startsWith('nutrition_')) return 'nutrizione';
            if (name.startsWith('workout_')) return 'allenamento';
            if (name.startsWith('food_')) return 'alimenti';
            if (name.startsWith('exercise_')) return 'esercizi';
            if (name.startsWith('athlete_')) return 'atleta';
            if (name.startsWith('analytics_')) return 'analytics';
            return 'altro';
          })
        );

        dynamicInstructions += `\n\nTOOL DISPONIBILI (${toolNames.length} totali):
Categorie: ${Array.from(toolCategories).join(', ')}

SCELTA AUTONOMA: Decidi autonomamente:
- Quali tool usare per ogni task
- In quale ordine chiamarli
- Come combinare i risultati
- Quando è necessario cercare informazioni vs creare direttamente

IMPORTANTE: 
- Dopo ogni chiamata tool, fornisci sempre una risposta testuale all'utente
- Spiega le tue decisioni quando rilevante (es. perché hai scelto un certo approccio)`;
      }

      // Build provider options for OpenRouter routing (uses preferredProvider from admin settings)
      const preferredProvider = callOpts.modelOverride?.preferredProvider;
      const routingOptions =
        provider === 'openrouter' ? buildProviderOptions({ modelId, preferredProvider }) : {};

      // Merge routing options with reasoning options
      const mergedProviderOptions = {
        ...routingOptions,
        ...(callOpts.reasoning && {
          openai: {
            reasoningEffort: callOpts.reasoningEffort,
          },
        }),
      };

      return {
        ...settings,
        model: createLanguageModel(provider, modelId),
        instructions: dynamicInstructions,
        maxOutputTokens: maxTokens,
        // Provider options (routing + reasoning)
        ...(Object.keys(mergedProviderOptions).length > 0 && {
          providerOptions: mergedProviderOptions,
        }),
      };
    },
  });

  return agent;
}

// ============================================================================
// Export Types
// ============================================================================

export type ChatAgent = ReturnType<typeof createChatAgent>;
