/**
 * Screen Context Registry
 * Maps screens/routes to context builders for universal copilot
 *
 * SOTA Features:
 * - Auto-detection of screen context
 * - Dynamic capability determination
 * - Extensible registry pattern
 * - Type-safe screen matching
 */

// Inline types for copilot - @repo/types not available
type CopilotScreen = string;
type CopilotDomain = 'nutrition' | 'workout' | 'general' | 'exercise' | 'analytics' | 'chat';
interface ContextRegistryEntry {
  screen: CopilotScreen;
  domain: CopilotDomain;
  pattern: RegExp;
  builder: (
    userId: string,
    params?: Record<string, unknown>
  ) => Promise<{ context: Record<string, unknown>; capabilities: CopilotCapabilities }>;
}
interface CopilotCapabilities {
  canGenerate: boolean;
  canModify: boolean;
  canAnalyze: boolean;
  canChat: boolean;
  canUseCamera: boolean;
  canAccessHealth: boolean;
  canCoach?: boolean; // NEW: for live workout coaching
  suggestedPrompts?: string[];
}
import { buildNutritionContext, buildWorkoutContext, buildChatContext } from './context-builder';
import { buildExerciseContext } from './exercise-context-builder';
import { buildAnalyticsContext } from './analytics-context-builder';

/**
 * Default capabilities template
 */
const DEFAULT_CAPABILITIES: CopilotCapabilities = {
  canGenerate: false,
  canModify: false,
  canAnalyze: false,
  canChat: true,
  canUseCamera: false,
  canAccessHealth: false,
  suggestedPrompts: [],
};

/**
 * Screen Context Registry
 * Singleton pattern for managing screen-to-context mappings
 */
class ScreenContextRegistry {
  private registry: Map<CopilotScreen, ContextRegistryEntry> = new Map();

  constructor() {
    this.initializeDefaultEntries();
  }

  /**
   * Initialize default screen entries
   */
  private initializeDefaultEntries(): void {
    // Dashboard - General chat with analytics
    this.register({
      screen: 'dashboard',
      domain: 'general',
      pattern: /^\/(dashboard|home)$/,
      builder: async (userId: string) => {
        const context = await buildChatContext(userId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canAnalyze: true,
            canChat: true,
            canAccessHealth: true,
            suggestedPrompts: [
              'Mostrami un riepilogo del mio progresso',
              'Come sta andando la mia settimana?',
              'Suggerimenti per migliorare i risultati',
            ],
          },
        };
      },
    });

    // Nutrition Plan View
    this.register({
      screen: 'nutrition_plan',
      domain: 'nutrition',
      pattern: /^\/nutrition\/plans\/([^/]+)$/,
      builder: async (userId: string, params?: Record<string, unknown>) => {
        const planId = params?.planId as string;
        const context = await buildNutritionContext(userId, planId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canModify: true,
            canAnalyze: true,
            canChat: true,
            canUseCamera: true,
            suggestedPrompts: [
              'Modifica il pasto di oggi',
              'Sostituisci un alimento',
              'Analizza i macros',
              "Scatta foto di un'etichetta",
            ],
          },
        };
      },
    });

    // Nutrition Day View
    this.register({
      screen: 'nutrition_day',
      domain: 'nutrition',
      pattern: /^\/nutrition\/plans\/([^/]+)\/day\/(\d+)$/,
      builder: async (userId: string, params?: Record<string, unknown>) => {
        const planId = params?.planId as string;
        const context = await buildNutritionContext(userId, planId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canModify: true,
            canAnalyze: true,
            canChat: true,
            canUseCamera: true,
            suggestedPrompts: [
              `Sostituisci il pranzo di oggi`,
              'Aggiungi uno spuntino',
              'Rimuovi un alimento',
              'Scansiona etichetta alimentare',
            ],
          },
        };
      },
    });

    // Workout Program View
    this.register({
      screen: 'workout_program',
      domain: 'workout',
      pattern: /^\/workout\/programs\/([^/]+)$/,
      builder: async (userId: string, params?: Record<string, unknown>) => {
        const programId = params?.programId as string;
        const context = await buildWorkoutContext(userId, programId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canModify: true,
            canAnalyze: true,
            canChat: true,
            suggestedPrompts: [
              'Modifica il workout di oggi',
              'Sostituisci un esercizio',
              "Aumenta l'intensità",
              'Adatta per infortunio',
            ],
          },
        };
      },
    });

    // Workout Week View
    this.register({
      screen: 'workout_week',
      domain: 'workout',
      pattern: /^\/workout\/programs\/([^/]+)\/week\/(\d+)$/,
      builder: async (userId: string, params?: Record<string, unknown>) => {
        const programId = params?.programId as string;
        const context = await buildWorkoutContext(userId, programId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canModify: true,
            canAnalyze: true,
            canChat: true,
            suggestedPrompts: [
              'Modifica sessione di oggi',
              'Sostituisci esercizio',
              'Aggiungi superset',
            ],
          },
        };
      },
    });

    // Exercises Database
    this.register({
      screen: 'exercises',
      domain: 'exercise',
      pattern: /^\/exercises(\/.*)?$/,
      builder: async (userId: string) => {
        const context = await buildExerciseContext(userId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canGenerate: true,
            canAnalyze: true,
            canChat: true,
            suggestedPrompts: [
              'Cerca esercizi per petto',
              'Crea nuovi esercizi',
              'Mostra alternative per squat',
            ],
          },
        };
      },
    });

    // Analytics
    this.register({
      screen: 'analytics',
      domain: 'analytics',
      pattern: /^\/analytics(\/.*)?$/,
      builder: async (userId: string) => {
        const context = await buildAnalyticsContext(userId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canAnalyze: true,
            canChat: true,
            canAccessHealth: true,
            suggestedPrompts: [
              'Analizza il mio progresso',
              'Confronta questa settimana con la precedente',
              'Mostra trend di peso',
            ],
          },
        };
      },
    });

    // Food Camera
    this.register({
      screen: 'food_camera',
      domain: 'nutrition',
      pattern: /^\/nutrition\/camera$/,
      builder: async (userId: string) => {
        const context = await buildChatContext(userId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canUseCamera: true,
            canChat: true,
            suggestedPrompts: ['Scansiona etichetta', 'Fotografa il piatto', 'Analizza nutrienti'],
          },
        };
      },
    });

    // Profile
    this.register({
      screen: 'profile',
      domain: 'general',
      pattern: /^\/profile(\/.*)?$/,
      builder: async (userId: string) => {
        const context = await buildChatContext(userId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canModify: true,
            canChat: true,
            suggestedPrompts: [
              'Aggiorna i miei obiettivi',
              'Modifica le preferenze alimentari',
              'Cambia livello di attività',
            ],
          },
        };
      },
    });

    // Chat - General purpose
    this.register({
      screen: 'chat',
      domain: 'chat',
      pattern: /^\/chat(\/.*)?$/,
      builder: async (userId: string) => {
        const context = await buildChatContext(userId);
        return {
          context: context as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canChat: true,
            canGenerate: true,
            canAnalyze: true,
            suggestedPrompts: [
              'Crea un piano nutrizionale',
              'Genera un programma di allenamento',
              'Consigli su alimentazione',
            ],
          },
        };
      },
    });

    // Live Workout Session - Real-time coaching
    this.register({
      screen: 'workout_session',
      domain: 'workout',
      pattern: /^\/workout\/session\/([^/]+)$/,
      builder: async (userId: string, params?: Record<string, unknown>) => {
        const sessionId = params?.sessionId as string;
        // Use chat context - live session data comes from LiveSessionContext store
        const context = await buildChatContext(userId);
        return {
          context: {
            ...context,
            sessionId,
            isLiveSession: true,
          } as Record<string, unknown>,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            canModify: false, // No structural modifications during live session
            canAnalyze: true,
            canChat: true,
            canCoach: true, // New capability for live coaching
            suggestedPrompts: [
              'Come sta andando questo esercizio?',
              'Suggeriscimi il peso per il prossimo set',
              'Quanto riposo mi serve?',
              'Posso aumentare il carico?',
            ],
          },
        };
      },
    });
  }

  /**
   * Register a new screen context entry
   */
  register(entry: ContextRegistryEntry): void {
    this.registry.set(entry.screen, entry);
  }

  /**
   * Detect screen from route
   */
  detectScreen(route: string): {
    screen: CopilotScreen;
    domain: CopilotDomain;
    params?: Record<string, string | number>;
  } {
    for (const [screen, entry] of this.registry.entries()) {
      const match = route.match(entry.pattern);
      if (match) {
        // Extract params from regex groups
        const params: Record<string, string | number> = {};
        if (match.length > 1 && match[1]) {
          params.planId = match[1];
          if (match.length > 2 && match[2]) {
            params.dayNumber = parseInt(match[2], 10);
          }
        }

        return {
          screen,
          domain: entry.domain,
          params: Object.keys(params).length > 0 ? params : undefined,
        };
      }
    }

    // Fallback to chat
    return {
      screen: 'unknown',
      domain: 'chat',
    };
  }

  /**
   * Get context builder for screen
   */
  async getContext(
    screen: CopilotScreen,
    userId: string,
    params?: Record<string, string | number>
  ): Promise<{
    context: Record<string, unknown>;
    capabilities: CopilotCapabilities;
  }> {
    const entry = this.registry.get(screen);

    if (!entry) {
      // Fallback to chat context
      const context = await buildChatContext(userId);
      return {
        context,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          canChat: true,
        },
      };
    }

    return entry.builder(userId, params);
  }

  /**
   * Get all registered screens
   */
  getRegisteredScreens(): CopilotScreen[] {
    return Array.from(this.registry.keys());
  }
}

// Export singleton instance
export const screenContextRegistry = new ScreenContextRegistry();
