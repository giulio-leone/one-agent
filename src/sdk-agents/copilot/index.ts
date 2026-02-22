/**
 * Copilot SDK 4.2 Agent Entry Point
 *
 * Provides both structured execution and streaming for chat UI.
 */
import { ToolLoopAgent, stepCountIs, tool } from '@giulio-leone/lib-ai';
import { z } from 'zod';
import {
  getModelByTier,
  AIProviderConfigService,
  buildProviderOptions,
  type ProviderName,
} from '@giulio-leone/lib-ai';
import { execute as sdkExecute } from '../../framework';
import type { ExecutionResult, PersistenceAdapter } from '../../framework';
import { registerCopilotSchemas, type CopilotInput, type CopilotOutput } from './schema';
import { GENERAL_CHAT_PROMPT } from './workers/general-chat';

// Register schemas on module load
registerCopilotSchemas();

export interface CopilotOptions {
  userId: string;
  persistence?: PersistenceAdapter;
}

export interface CopilotStreamOptions {
  userId: string;
  tier?: 'fast' | 'balanced' | 'quality';
  mcpTools?: Record<string, unknown>;
  onFinish?: (result: { text: string; usage: unknown }) => void;
  userProfile?: Record<string, unknown>; // Passed from chat route
}

/**
 * Execute Copilot agent using SDK 4.2 (structured output)
 */
export async function executeCopilot(
  input: CopilotInput,
  options: CopilotOptions
): Promise<ExecutionResult<CopilotOutput>> {
  const agentPath = new URL('.', import.meta.url).pathname;

  return sdkExecute(agentPath, input, {
    userId: options.userId,
    persistence: options.persistence,
  }) as Promise<ExecutionResult<CopilotOutput>>;
}

/**
 * Execute Copilot with streaming for chat UI
 *
 * This is the main entry point for the chat route.
 * Returns a streaming response compatible with AI SDK v6.
 */
export async function executeCopilotStream(
  input: {
    query: string;
    userId: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    context?: Record<string, unknown>;
  },
  options: CopilotStreamOptions
) {
  // 1. Detect domain from query
  const domain = await detectDomain(input.query, input.context);
  console.log('[Copilot] Detected domain:', domain);

  // 2. Get model from admin settings
  const modelConfig = await getModelByTier(options.tier ?? 'balanced');
  const apiKey = await AIProviderConfigService.getApiKey(modelConfig.provider as ProviderName);

  if (!apiKey) {
    throw new Error(`API key mancante per il provider ${modelConfig.provider}`);
  }

  const { createModelAsync } = await import('@giulio-leone/lib-ai');
  const model = await createModelAsync(modelConfig, apiKey);

  // 3. Build provider options for OpenRouter
  const preferredProvider =
    modelConfig.provider === 'openrouter'
      ? await AIProviderConfigService.getDefaultProvider('openrouter')
      : null;

  const providerOptions =
    modelConfig.provider === 'openrouter'
      ? buildProviderOptions({ modelId: modelConfig.model, preferredProvider })
      : undefined;

  // 4. Build tools for domain delegation
  const tools = buildDelegationTools(options.mcpTools ?? {}, options.userId, options.userProfile);

  // 5. Build system prompt
  const systemPrompt = buildCopilotSystemPrompt(domain);

  // 6. Create ToolLoopAgent for streaming
  const agent = new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(15),
    toolChoice: 'auto',
    ...(providerOptions && { providerOptions }),
  });

  // 7. Stream response
  const streamResult = await agent.stream({
    prompt: input.query,
  });

  // Return the stream result for the chat route to handle
  return {
    stream: streamResult,
    domain,
  };
}

/**
 * Detect domain from query using keyword matching
 * Fast, no LLM call needed for obvious cases
 */
async function detectDomain(
  query: string,
  context?: Record<string, unknown>
): Promise<'nutrition' | 'workout' | 'flight' | 'oneagenda' | 'general'> {
  const q = query.toLowerCase();

  // Check explicit context domain first
  if (context?.domain && typeof context.domain === 'string') {
    const validDomains = ['nutrition', 'workout', 'flight', 'oneagenda'];
    if (validDomains.includes(context.domain)) {
      return context.domain as 'nutrition' | 'workout' | 'flight' | 'oneagenda';
    }
  }

  // Keyword-based detection
  const domainKeywords = {
    nutrition: [
      'meal',
      'calorie',
      'protein',
      'diet',
      'food',
      'eat',
      'macro',
      'pasto',
      'caloria',
      'dieta',
      'cibo',
      'mangiare',
    ],
    workout: [
      'exercise',
      'workout',
      'training',
      'gym',
      'sets',
      'reps',
      'muscle',
      'strength',
      'esercizio',
      'allenamento',
      'palestra',
      'muscolo',
    ],
    flight: [
      'flight',
      'fly',
      'airport',
      'travel',
      'ticket',
      'airline',
      'volo',
      'volare',
      'aeroporto',
      'viaggio',
      'biglietto',
    ],
    oneagenda: [
      'task',
      'project',
      'schedule',
      'deadline',
      'milestone',
      'habit',
      'todo',
      'compito',
      'progetto',
      'scadenza',
    ],
  };

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some((kw) => q.includes(kw))) {
      return domain as 'nutrition' | 'workout' | 'flight' | 'oneagenda';
    }
  }

  return 'general';
}

/**
 * Build delegation tools for calling domain agents
 */
/**
 * Build delegation tools for calling domain agents
 */
function buildDelegationTools(
  mcpTools: Record<string, unknown>,
  userId: string,
  userProfile?: Record<string, unknown>
) {
  return {
    // Delegation tools call SDK 4.2 agents
    delegateToNutrition: tool({
      description:
        'Generate comprehensive nutrition plans or analyze dietary requirements using SDK 4.2.',
      inputSchema: z.object({
        goal: z
          .enum(['weight_loss', 'muscle_gain', 'maintenance', 'performance'])
          .describe('Nutritional goal'),
        mealsPerDay: z.number().min(3).max(6).default(4),
        durationWeeks: z.number().default(4),
        restrictions: z
          .object({
            dietType: z.string().optional(),
            allergies: z.array(z.string()).default([]),
            intolerances: z.array(z.string()).default([]),
          })
          .optional(),
      }),
      execute: async (input: {
        goal: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'performance';
        mealsPerDay: number;
        durationWeeks: number;
        restrictions?: {
          dietType?: string;
          allergies: string[];
          intolerances: string[];
        };
      }) => {
        try {
          // @ts-ignore - Dynamic import to avoid circular dependency
          const { generateNutritionPlan } = await import('@giulio-leone/lib-nutrition');

          // Map generic profile to NutritionUserProfile
          const profile = {
            weight: Number(userProfile?.weight ?? 70),
            height: Number(userProfile?.height ?? 175),
            age: Number(userProfile?.age ?? 30),
            gender: (userProfile?.gender as 'male' | 'female' | 'other') ?? 'male',
            activityLevel:
              (userProfile?.activityLevel?.toString().toUpperCase() as any) ?? 'MODERATE',
          };

          const result = await generateNutritionPlan({
            userId,
            userProfile: profile,
            goals: {
              goal: input.goal,
              mealsPerDay: input.mealsPerDay,
              durationWeeks: input.durationWeeks,
              patternsCount: 2,
            },
            restrictions: {
              allergies: [],
              intolerances: [],
              excludedFoods: [],
              preferredFoods: [],
              ...(input.restrictions || {}),
            },
          });

          if (!result.success) throw new Error(result.error?.message);

          return {
            success: true,
            message: `Piano nutrizionale generato: ${result.output?.plan.name}. Focus: ${input.goal}.`,
            data: result.output?.plan,
          };
        } catch (e: any) {
          return { success: false, message: `Errore generazione nutrizione: ${e.message}` };
        }
      },
    }),

    delegateToWorkout: tool({
      description: 'Generate personalized workout programs using SDK 4.2 agents.',
      inputSchema: z.object({
        primaryGoal: z.enum(['strength', 'hypertrophy', 'endurance', 'power', 'general_fitness']),
        daysPerWeek: z.number().min(2).max(7).describe('Training days per week'),
        durationWeeks: z.number().default(4),
        location: z.enum(['gym', 'home', 'outdoor']).default('gym'),
        sessionDuration: z.number().default(60),
      }),
      execute: async (input: {
        primaryGoal: 'strength' | 'hypertrophy' | 'endurance' | 'power' | 'general_fitness';
        daysPerWeek: number;
        durationWeeks: number;
        location: 'gym' | 'home' | 'outdoor';
        sessionDuration: number;
      }) => {
        try {
          // @ts-ignore - Dynamic import to avoid circular dependency
          const { generateWorkoutProgram } = await import('@giulio-leone/one-workout');

          const profile = {
            weight: Number(userProfile?.weight ?? 70),
            height: Number(userProfile?.height ?? 175),
            age: Number(userProfile?.age ?? 30),
            gender: (userProfile?.gender as 'male' | 'female' | 'other') ?? 'male',
            experienceLevel: 'intermediate' as const, // Default, hard to infer without asking
            fitnessLevel: (userProfile?.activityLevel as any) ?? 'moderate',
          };

          const result = await generateWorkoutProgram({
            userId,
            userProfile: profile,
            goals: {
              primary: input.primaryGoal,
              targetMuscles: [], // Full body default if empty
              daysPerWeek: input.daysPerWeek,
              duration: input.durationWeeks,
              sessionDuration: input.sessionDuration,
            },
            constraints: {
              location: input.location,
              equipment: [], // Auto-detected by agent based on location
              timePerSession: input.sessionDuration,
            },
          });

          if (!result.success) throw new Error(result.error?.message);

          return {
            success: true,
            message: `Programma allenamento generato: ${result.output?.program.name}. Split: ${result.output?.program.splitType}.`,
            data: result.output?.program,
          };
        } catch (e: any) {
          return { success: false, message: `Errore generazione workout: ${e.message}` };
        }
      },
    }),

    delegateToFlight: tool({
      description: 'Delegate to the flight search agent for finding flights.',
      inputSchema: z.object({
        flyFrom: z.array(z.string()).describe('Origin airports'),
        flyTo: z.array(z.string()).describe('Destination airports'),
        departureDate: z.string().describe('YYYY-MM-DD'),
        returnDate: z.string().optional(),
        maxResults: z.number().optional().default(5),
      }),
      execute: async (input: {
        flyFrom: string[];
        flyTo: string[];
        departureDate: string;
        returnDate?: string;
        maxResults?: number;
      }) => {
        const { executeFlightSearch } = await import('@giulio-leone/lib-flight');
        const result = await executeFlightSearch(
          {
            ...input,
            maxResults: input.maxResults ?? 5,
            currency: 'EUR',
          },
          { userId: 'system' }
        );

        if (!result.success || !result.output) {
          return { success: false, message: result.error?.message || 'Errore nella ricerca voli' };
        }

        const rec = result.output.recommendation;
        return {
          success: true,
          message: `Trovati ${result.output.outbound.length} voli. Raccomandazione: ${rec.strategy} - €${rec.totalPrice}. ${rec.reasoning}`,
          data: result.output,
        };
      },
    }),

    delegateToOneAgenda: tool({
      description: 'Generate daily agenda and schedule tasks using SDK 4.2.',
      inputSchema: z.object({
        date: z.string().describe('YYYY-MM-DD'),
        tasks: z.array(
          z.object({
            title: z.string(),
            priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
            estimatedMinutes: z.number().default(30),
          })
        ),
        events: z.array(z.any()).default([]),
      }),
      execute: async (input: {
        date: string;
        tasks: Array<{
          title: string;
          priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
          estimatedMinutes: number;
        }>;
        events: any[];
      }) => {
        try {
          const { generateAgenda } = await import('@giulio-leone/oneagenda-core');

          const result = await generateAgenda({
            userId,
            date: input.date,
            tasks: input.tasks.map((t) => ({
              id: crypto.randomUUID(),
              title: t.title,
              priority: t.priority,
              effort: { estimatedMinutes: t.estimatedMinutes, complexity: 'MODERATE' },
              dependencies: [],
              tags: [],
            })),
            events: input.events,
            preferences: {
              userId,
              timezone: 'Europe/Rome',
              workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00', enabled: true }], // Simplify defaults
              breaks: { breakDurationMinutes: 15, breakFrequencyMinutes: 90 },
              scheduling: { allowTaskSplitting: false, bufferBetweenTasksMinutes: 5 },
            },
            mode: 'PLAN',
          });

          // generateAgenda returns output directly on success, throws on error
          return {
            success: true,
            message: `Agenda generata per il ${input.date}. ${result.plan.summary.taskCount} task pianificati.`,
            data: result,
          };
        } catch (e: any) {
          return { success: false, message: `Errore OneAgenda: ${e.message}` };
        }
      },
    }),

    // Include MCP tools passed from chat route
    ...mcpTools,
  };
}

/**
 * Build system prompt based on detected domain
 */
function buildCopilotSystemPrompt(domain: string): string {
  const basePrompt = `
# OneCoach Copilot

You are OneCoach, a helpful AI assistant for health, fitness, and productivity.

## Current Focus: ${domain.toUpperCase()}

${domain === 'general' ? GENERAL_CHAT_PROMPT : ''}

## Guidelines

1. Be concise and helpful
2. Use the delegation tools when the user asks about specific domains
3. Respond in the user's language (Italian or English)
4. For complex requests, break them down into steps
5. Always be encouraging and supportive
`;

  return basePrompt;
}

// Re-export types
export type { CopilotInput, CopilotOutput } from './schema';
