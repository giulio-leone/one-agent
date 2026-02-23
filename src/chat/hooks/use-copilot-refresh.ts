import { useEffect, useRef } from 'react';
import {
  useCopilotActiveContextStore,
  type CopilotActiveContextStore,
} from '@giulio-leone/lib-stores';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for domain-agnostic store sync
 */
export interface UseCopilotSyncConfig<T> {
  /**
   * Selector function to extract relevant data from copilot-active-context store.
   * Return undefined/null if no relevant data exists.
   * 
   * @example
   * selector: (state) => state.workout?.program
   */
  selector: (state: CopilotActiveContextStore) => T | undefined | null;
  
  /**
   * Callback called when the selected data changes.
   * Use this to sync with your local state (e.g., versioning store)
   */
  onDataChanged: (data: T) => void;
  
  /**
   * Whether the hook is enabled (default: true)
   */
  enabled?: boolean;
}

// ============================================================================
// Core Hook - Domain Agnostic
// ============================================================================

/**
 * Domain-agnostic hook for instant sync between copilot-active-context and visual builder stores.
 * 
 * This hook subscribes directly to the copilot-active-context store using a user-provided
 * selector function. When the selected data changes, onDataChanged is called immediately.
 * 
 * Benefits:
 * - No API fetch required (instant updates)
 * - No hardcoded domain logic
 * - Works with any future domain that stores data in copilot-active-context
 * 
 * @example
 * ```tsx
 * // Any domain - just provide a selector
 * useCopilotSync<WorkoutProgram>({
 *   selector: (state) => state.workout?.program,
 *   onDataChanged: replaceStateFromExternal,
 * });
 * ```
 */
export function useCopilotSync<T>(config: UseCopilotSyncConfig<T>): void {
  const { selector, onDataChanged, enabled = true } = config;

  // Stable refs to avoid dependency issues
  const selectorRef = useRef(selector);
  const onDataChangedRef = useRef(onDataChanged);
  selectorRef.current = selector;
  onDataChangedRef.current = onDataChanged;
  
  // Track last synced data to avoid duplicate updates (by reference)
  const lastSyncedRef = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Subscribe to store changes
    const unsubscribe = useCopilotActiveContextStore.subscribe(
      (state) => {
        const currentData = selectorRef.current(state);
        
        // Only sync if:
        // 1. We have data
        // 2. It's different from last synced (reference equality)
        if (
          currentData !== undefined &&
          currentData !== null &&
          currentData !== lastSyncedRef.current
        ) {
          lastSyncedRef.current = currentData;
          onDataChangedRef.current(currentData);
        }
      }
    );

    return () => unsubscribe();
  }, [enabled]);
}

// ============================================================================
// Convenience Hooks - Type-safe wrappers for specific domains
// ============================================================================

/**
 * Instant sync for workout visual builder.
 * 
 * @example
 * ```tsx
 * useWorkoutCopilotSync<WorkoutProgram>({
 *   programId: initialProgram?.id,
 *   onDataChanged: replaceStateFromExternal,
 * });
 * ```
 */
export function useWorkoutCopilotSync<T = unknown>(config: {
  programId: string | undefined | null;
  onDataChanged: (program: T) => void;
  enabled?: boolean;
}): void {
  useCopilotSync<T>({
    selector: (state) => {
      if (state.workout?.programId === config.programId) {
        return state.workout?.program as T | undefined;
      }
      return undefined;
    },
    onDataChanged: config.onDataChanged,
    enabled: config.enabled !== false && !!config.programId,
  });
}

/**
 * Instant sync for nutrition visual builder.
 * 
 * @example
 * ```tsx
 * useNutritionCopilotSync<NutritionPlan>({
 *   planId: initialPlan?.id,
 *   onDataChanged: replaceStateFromExternal,
 * });
 * ```
 */
export function useNutritionCopilotSync<T = unknown>(config: {
  planId: string | undefined | null;
  onDataChanged: (plan: T) => void;
  enabled?: boolean;
}): void {
  useCopilotSync<T>({
    selector: (state) => {
      if (state.nutrition?.planId === config.planId) {
        return state.nutrition?.plan as T | undefined;
      }
      return undefined;
    },
    onDataChanged: config.onDataChanged,
    enabled: config.enabled !== false && !!config.planId,
  });
}

/**
 * Instant sync for OneAgenda projects.
 * 
 * NOTE: Requires extending copilot-active-context to store the full project.
 * Currently OneAgenda context only stores projectId, not the full data.
 * Once extended, use this pattern:
 * 
 * @example
 * ```tsx
 * useOneAgendaCopilotSync<Project>({
 *   projectId: initialProject?.id,
 *   onDataChanged: replaceStateFromExternal,
 * });
 * ```
 */
export function useOneAgendaCopilotSync<T = unknown>(config: {
  projectId: string | undefined | null;
  onDataChanged: (project: T) => void;
  enabled?: boolean;
}): void {
  useCopilotSync<T>({
    selector: (state) => {
      if (state.oneAgenda?.projectId === config.projectId) {
        // TODO: Add project data to OneAgendaActiveContext
        // return state.oneAgenda?.project as T | undefined;
        return undefined; // Not yet available
      }
      return undefined;
    },
    onDataChanged: config.onDataChanged,
    enabled: config.enabled !== false && !!config.projectId,
  });
}
