/**
 * useGlobalCopilotContext Hook
 *
 * Lightweight global hook for automatic context synchronization.
 * Use in the main layout to enable Copilot awareness app-wide.
 *
 * PERFORMANCE: This hook is extremely lightweight:
 * - Zustand store is a singleton (no Context Provider overhead)
 * - Only syncs on route change (usePathname)
 * - No component re-renders (uses subscriber pattern)
 *
 * @module lib-copilot/hooks/useGlobalCopilotContext
 */

'use client';

import { useEffect, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useCopilotActiveContextStore, type ActiveDomain } from '@giulio-leone/lib-stores';

// ============================================================================
// Route Pattern Detection
// ============================================================================

interface DetectedRoute {
  domain: ActiveDomain;
  programId?: string;
  planId?: string;
  projectId?: string;
  weekNumber?: number;
  dayNumber?: number;
}

/**
 * Detect domain and IDs from pathname
 */
function detectRouteContext(pathname: string, params: Record<string, string>): DetectedRoute {
  // Workout routes: /workout/[id]/... or /workouts/[id]/...
  if (pathname.includes('/workout')) {
    return {
      domain: 'workout',
      programId: params.id || extractIdFromPath(pathname, /\/workouts?\/([^/]+)/),
    };
  }

  // Nutrition routes: /nutrition/[id]/... or /nutrition-plans/[id]/...
  if (pathname.includes('/nutrition')) {
    return {
      domain: 'nutrition',
      planId: params.id || extractIdFromPath(pathname, /\/nutrition(?:-plans)?\/([^/]+)/),
    };
  }

  // OneAgenda routes: /agenda/[id]/... or /projects/[id]/...
  if (pathname.includes('/agenda') || pathname.includes('/project')) {
    return {
      domain: 'oneagenda',
      projectId: params.id || extractIdFromPath(pathname, /\/(?:agenda|projects?)\/([^/]+)/),
    };
  }

  // No specific domain detected
  return { domain: null };
}

/**
 * Extract ID from pathname using regex
 */
function extractIdFromPath(pathname: string, pattern: RegExp): string | undefined {
  const match = pathname.match(pattern);
  return match?.[1];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export interface UseGlobalCopilotContextOptions {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Global Copilot context synchronization hook.
 *
 * Place this once in your root layout to enable automatic domain detection.
 * Components then use `useCopilotContextReporter` for granular selection reporting.
 *
 * @example
 * ```tsx
 * // In app/layout.tsx or (protected)/layout.tsx
 * function Layout({ children }) {
 *   useGlobalCopilotContext();
 *   return <>{children}</>;
 * }
 * ```
 */
export function useGlobalCopilotContext(options: UseGlobalCopilotContextOptions = {}) {
  const { debug = false } = options;

  const pathname = usePathname();
  const params = useParams() as Record<string, string>;

  // Get store actions (stable references)
  const setDomain = useCopilotActiveContextStore((s) => s.setDomain);
  const initWorkoutContext = useCopilotActiveContextStore((s) => s.initWorkoutContext);
  const initNutritionContext = useCopilotActiveContextStore((s) => s.initNutritionContext);
  const initOneAgendaContext = useCopilotActiveContextStore((s) => s.initOneAgendaContext);
  const clearContext = useCopilotActiveContextStore((s) => s.clearContext);

  // Current store state
  const currentDomain = useCopilotActiveContextStore((s) => s.domain);
  const currentWorkout = useCopilotActiveContextStore((s) => s.workout);
  const currentNutrition = useCopilotActiveContextStore((s) => s.nutrition);
  const currentOneAgenda = useCopilotActiveContextStore((s) => s.oneAgenda);

  // Sync route context
  const syncContext = useCallback(() => {
    if (debug) {
      console.log('[GlobalCopilotContext] syncContext START', { pathname, params });
    }

    const detected = detectRouteContext(pathname, params);

    if (debug) {
      console.log(
        '[GlobalCopilotContext] Route detected:',
        detected,
        'Current domain:',
        currentDomain
      );
    }

    // If domain changed, update
    if (detected.domain !== currentDomain) {
      if (debug) {
        console.log(
          '[GlobalCopilotContext] Domain CHANGED from',
          currentDomain,
          'to',
          detected.domain
        );
      }
      if (detected.domain === null) {
        clearContext();
      } else {
        setDomain(detected.domain);
      }
    }

    // Sync domain-specific context (only IDs, not full objects)
    // Full objects are set by CopilotDomainProvider or directly by components
    switch (detected.domain) {
      case 'workout':
        if (detected.programId && detected.programId !== currentWorkout?.programId) {
          if (debug) {
            console.log(
              '[GlobalCopilotContext] Initializing workout context with programId:',
              detected.programId
            );
          }
          // Initialize workout context with programId (program object will be set by page/provider)
          initWorkoutContext(detected.programId, null as never);
        }
        break;

      case 'nutrition':
        if (detected.planId && detected.planId !== currentNutrition?.planId) {
          if (debug) {
            console.log(
              '[GlobalCopilotContext] Initializing nutrition context with planId:',
              detected.planId
            );
          }
          // Initialize nutrition context with planId (plan object will be set by page/provider)
          initNutritionContext(detected.planId, null as never);
        }
        break;

      case 'oneagenda':
        if (detected.projectId && detected.projectId !== currentOneAgenda?.projectId) {
          if (debug) {
            console.log(
              '[GlobalCopilotContext] Initializing oneagenda context with projectId:',
              detected.projectId
            );
          }
          initOneAgendaContext(detected.projectId);
        }
        break;
    }

    if (debug) {
      console.log('[GlobalCopilotContext] syncContext END');
    }
  }, [
    pathname,
    params,
    currentDomain,
    currentWorkout?.programId,
    currentNutrition?.planId,
    currentOneAgenda?.projectId,
    setDomain,
    initWorkoutContext,
    initNutritionContext,
    initOneAgendaContext,
    clearContext,
    debug,
  ]);

  // Run on mount and route change
  useEffect(() => {
    syncContext();
  }, [syncContext]);

  // Return nothing - this is a side-effect only hook
}

export default useGlobalCopilotContext;
