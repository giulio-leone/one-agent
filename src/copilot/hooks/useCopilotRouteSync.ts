/**
 * useCopilotRouteSync Hook
 *
 * Automatically synchronizes route context to Zustand store for MCP tools.
 * Eliminates fragile URL parameter parsing by maintaining context centrally.
 *
 * Features:
 * - Automatic domain detection from route patterns
 * - Extraction of IDs (athleteId, planId, programId, etc.) from route
 * - Real-time sync when route changes
 * - Support for all app domains (nutrition, workout, exercise, etc.)
 *
 * @module lib-copilot/hooks/useCopilotRouteSync
 */

'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useCopilotStore, type CopilotDomain } from '@giulio-leone/lib-stores';

/**
 * Route pattern matchers for domain detection
 */
const ROUTE_PATTERNS = {
  // Nutrition routes
  nutrition: /\/nutrition\/([a-zA-Z0-9-]+)/,
  nutritionPlan: /\/nutrition\/([a-zA-Z0-9-]+)(?:\/track)?/,

  // Workout routes
  workout: /\/workout\/([a-zA-Z0-9-]+)/,
  workoutProgram: /\/workout\/([a-zA-Z0-9-]+)(?:\/week\/(\d+))?(?:\/day\/(\d+))?/,
  liveWorkout: /\/live-workout/,

  // Exercise routes
  exercise: /\/exercise(?:s)?(?:\/([a-zA-Z0-9-]+))?/,
  exerciseLibrary: /\/admin\/exercises/,

  // OneAgenda routes
  oneagenda: /\/oneagenda/,
  project: /\/oneagenda\/projects?\/([a-zA-Z0-9-]+)/,
  task: /\/oneagenda\/tasks?\/([a-zA-Z0-9-]+)/,
  habits: /\/oneagenda\/habits/,

  // Marketplace routes
  marketplace: /\/marketplace/,
  product: /\/marketplace\/products?\/([a-zA-Z0-9-]+)/,
  affiliate: /\/marketplace\/affiliate/,

  // Analytics routes
  analytics: /\/analytics/,

  // Athlete context (applies across domains)
  athlete: /\/athlete\/([a-zA-Z0-9-]+)/,

  // Admin routes
  admin: /\/admin/,

  // Chat routes
  chat: /\/chat/,

  // Settings routes
  settings: /\/settings/,
} as const;

/**
 * Determines the domain from the current route
 */
function detectDomain(pathname: string): CopilotDomain {
  if (ROUTE_PATTERNS.admin.test(pathname)) return 'admin';
  if (ROUTE_PATTERNS.nutrition.test(pathname)) return 'nutrition';
  if (ROUTE_PATTERNS.workout.test(pathname) || ROUTE_PATTERNS.liveWorkout.test(pathname))
    return 'workout';
  if (ROUTE_PATTERNS.exercise.test(pathname) || ROUTE_PATTERNS.exerciseLibrary.test(pathname))
    return 'exercise';
  if (ROUTE_PATTERNS.oneagenda.test(pathname)) return 'oneagenda';
  if (ROUTE_PATTERNS.marketplace.test(pathname)) return 'marketplace';
  if (ROUTE_PATTERNS.analytics.test(pathname)) return 'analytics';
  if (ROUTE_PATTERNS.chat.test(pathname)) return 'chat';
  if (ROUTE_PATTERNS.settings.test(pathname)) return 'settings';
  return null;
}

/**
 * Extracts athlete ID from route if present
 */
function extractAthleteId(pathname: string): string | null {
  const match = pathname.match(ROUTE_PATTERNS.athlete);
  return match?.[1] ?? null;
}

/**
 * Extracts locale from route
 */
function extractLocale(pathname: string): string {
  const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  return localeMatch?.[1] ?? 'it';
}

/**
 * Extracts nutrition-specific context from route
 */
function extractNutritionContext(pathname: string) {
  const planMatch = pathname.match(ROUTE_PATTERNS.nutritionPlan);
  return {
    planId: planMatch ? planMatch[1] : null,
    athleteId: extractAthleteId(pathname),
  };
}

/**
 * Extracts workout-specific context from route
 */
function extractWorkoutContext(pathname: string) {
  const programMatch = pathname.match(ROUTE_PATTERNS.workoutProgram);
  return {
    programId: programMatch ? programMatch[1] : null,
    weekNumber: programMatch && programMatch[2] ? parseInt(programMatch[2], 10) : null,
    dayNumber: programMatch && programMatch[3] ? parseInt(programMatch[3], 10) : null,
    athleteId: extractAthleteId(pathname),
  };
}

/**
 * Extracts exercise-specific context from route
 */
function extractExerciseContext(pathname: string) {
  const exerciseMatch = pathname.match(ROUTE_PATTERNS.exercise);
  return {
    exerciseId: exerciseMatch && exerciseMatch[1] ? exerciseMatch[1] : null,
  };
}

/**
 * Extracts OneAgenda-specific context from route
 */
function extractOneAgendaContext(pathname: string) {
  const projectMatch = pathname.match(ROUTE_PATTERNS.project);
  const taskMatch = pathname.match(ROUTE_PATTERNS.task);

  return {
    projectId: projectMatch?.[1] ?? null,
    taskId: taskMatch?.[1] ?? null,
    habitId: null, // Extracted from URL params if needed
    milestoneId: null,
  };
}

/**
 * Extracts marketplace-specific context from route
 */
function extractMarketplaceContext(pathname: string) {
  const productMatch = pathname.match(ROUTE_PATTERNS.product);

  return {
    productId: productMatch?.[1] ?? null,
    categoryId: null,
    affiliateCode: null,
    orderId: null,
  };
}

/**
 * Options for the hook
 */
interface UseCopilotRouteSyncOptions {
  /** Whether to enable automatic sync (default: true) */
  enabled?: boolean;
  /** Additional context to merge */
  additionalContext?: Record<string, unknown>;
}

/**
 * Hook to automatically sync route context to Copilot store
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   // Automatically syncs route context to Copilot store
 *   useCopilotRouteSync();
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * function NutritionPage({ planId, dayNumber }) {
 *   // Sync with additional context
 *   useCopilotRouteSync({
 *     additionalContext: {
 *       totalDays: 7,
 *       currentMealIndex: 0
 *     }
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useCopilotRouteSync(options: UseCopilotRouteSyncOptions = {}) {
  const { enabled = true, additionalContext } = options;
  const pathname = usePathname();

  const {
    setCurrentRoute,
    setMcpContext,
    setNutritionContext,
    setWorkoutContext,
    setExerciseContext,
    setOneAgendaContext,
    setMarketplaceContext,
    setDomain,
    setAthleteId,
  } = useCopilotStore();

  const syncContext = useCallback(() => {
    if (!pathname || !enabled) return;

    // Detect domain and extract context
    const domain = detectDomain(pathname);
    const locale = extractLocale(pathname);
    const athleteId = extractAthleteId(pathname);

    // Update base context
    setCurrentRoute(pathname);
    setMcpContext({
      route: pathname,
      locale,
      domain,
      athleteId,
    });

    if (athleteId) {
      setAthleteId(athleteId);
    }

    // Domain-specific context extraction
    switch (domain) {
      case 'nutrition': {
        const nutritionCtx = extractNutritionContext(pathname);
        setNutritionContext({
          ...nutritionCtx,
          ...(additionalContext as Record<string, unknown>),
        });
        break;
      }

      case 'workout': {
        const workoutCtx = extractWorkoutContext(pathname);
        setWorkoutContext({
          ...workoutCtx,
          ...(additionalContext as Record<string, unknown>),
        });
        break;
      }

      case 'exercise': {
        const exerciseCtx = extractExerciseContext(pathname);
        setExerciseContext({
          ...exerciseCtx,
          ...(additionalContext as Record<string, unknown>),
        });
        break;
      }

      case 'oneagenda': {
        const agendaCtx = extractOneAgendaContext(pathname);
        setOneAgendaContext({
          ...agendaCtx,
          ...(additionalContext as Record<string, unknown>),
        });
        break;
      }

      case 'marketplace': {
        const marketplaceCtx = extractMarketplaceContext(pathname);
        setMarketplaceContext({
          ...marketplaceCtx,
          ...(additionalContext as Record<string, unknown>),
        });
        break;
      }

      default:
        setDomain(domain);
        break;
    }
  }, [
    pathname,
    enabled,
    additionalContext,
    setCurrentRoute,
    setMcpContext,
    setNutritionContext,
    setWorkoutContext,
    setExerciseContext,
    setOneAgendaContext,
    setMarketplaceContext,
    setDomain,
    setAthleteId,
  ]);

  // Sync on mount and when pathname changes
  useEffect(() => {
    syncContext();
  }, [syncContext]);

  return {
    /** Force re-sync context */
    resync: syncContext,
    /** Current detected domain */
    domain: detectDomain(pathname || ''),
    /** Current pathname */
    pathname,
  };
}

/**
 * Hook to manually set context for specific domains
 * Use when you have context not derivable from URL
 *
 * @example
 * ```tsx
 * function NutritionDaySelector({ totalDays, currentDay }) {
 *   const { setNutritionContext } = useCopilotContext();
 *
 *   useEffect(() => {
 *     setNutritionContext({
 *       dayNumber: currentDay,
 *       totalDays
 *     });
 *   }, [currentDay, totalDays]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useCopilotContext() {
  const store = useCopilotStore();

  return {
    // Setters
    setNutritionContext: store.setNutritionContext,
    setWorkoutContext: store.setWorkoutContext,
    setExerciseContext: store.setExerciseContext,
    setOneAgendaContext: store.setOneAgendaContext,
    setMarketplaceContext: store.setMarketplaceContext,
    setAnalyticsContext: store.setAnalyticsContext,
    setAthleteId: store.setAthleteId,
    setDomain: store.setDomain,
    clearDomainContext: store.clearDomainContext,

    // Getters
    getMcpContext: store.getMcpContext,
    mcpContext: store.mcpContext,
    domain: store.mcpContext.domain,
    athleteId: store.mcpContext.athleteId,
  };
}

export default useCopilotRouteSync;
