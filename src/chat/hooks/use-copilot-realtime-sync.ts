import { useRef } from 'react';
import {
  useCopilotActiveContextStore,
  useRealtimeSubscription,
  type CopilotActiveContextStore,
} from '@giulio-leone/lib-stores';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for domain-agnostic realtime sync with copilot context
 */
export interface UseCopilotRealtimeSyncConfig<T> {
  /**
   * Database table to subscribe to (e.g., 'workout_programs', 'nutrition_plans')
   */
  table: string;
  
  /**
   * Record ID to filter updates
   */
  recordId: string | undefined | null;
  
  /**
   * Function to fetch the full transformed data after receiving a realtime update.
   * The realtime payload only contains raw DB columns; we need the full transformed object.
   * 
   * If `transformPayload` is provided and returns a value, this fetch is skipped.
   */
  fetchFn: () => Promise<T>;
  
  /**
   * Optional: Transform the Realtime payload directly to skip the fetch.
   * Return null to fall back to fetchFn.
   * 
   * This is the FAST PATH - use it when the Realtime payload contains
   * enough data to construct the updated object (e.g., weeks JSON).
   * 
   * @param payload - Raw Realtime payload (snake_case DB columns)
   * @param currentData - Current data from store (can be used for merging)
   */
  transformPayload?: (payload: Record<string, unknown>, currentData: T | null) => T | null;
  
  /**
   * Selector to update the copilot-active-context store with new data
   */
  updateStore: (store: CopilotActiveContextStore, data: T) => void;
  
  /**
   * Get current data from store (needed for transformPayload merging)
   */
  getCurrentData?: () => T | null;
  
  /**
   * Whether the hook is enabled (default: true)
   */
  enabled?: boolean;
  
  /**
   * Debounce delay in ms to batch rapid updates and prevent race conditions.
   * Default: 300ms. Set to 0 for immediate updates.
   */
  debounceMs?: number;
}

// ============================================================================
// Core Hook - Domain Agnostic Realtime → Copilot Context Sync
// ============================================================================

/**
 * Domain-agnostic hook for syncing Supabase Realtime updates to copilot-active-context.
 * 
 * When a database record changes, this hook:
 * 1. Receives the realtime notification
 * 2. Fetches the full transformed data
 * 3. Updates the copilot-active-context store
 * 4. Sync hooks in visual builders react to the store change
 * 
 * @example
 * ```tsx
 * useCopilotRealtimeSync<WorkoutProgram>({
 *   table: 'workout_programs',
 *   recordId: programId,
 *   fetchFn: () => fetch(`/api/workouts/${programId}`).then(r => r.json()).then(d => d.program),
 *   updateStore: (store, data) => store.updateWorkoutProgram(data),
 * });
 * ```
 */
export function useCopilotRealtimeSync<T>(config: UseCopilotRealtimeSyncConfig<T>): void {
  const { 
    table, 
    recordId, 
    fetchFn, 
    transformPayload,
    getCurrentData,
    updateStore, 
    enabled = true,
    debounceMs = 300, // Debounce to avoid rapid consecutive fetches
  } = config;

  // Refs for stable callbacks
  const fetchFnRef = useRef(fetchFn);
  const updateStoreRef = useRef(updateStore);
  const transformPayloadRef = useRef(transformPayload);
  const getCurrentDataRef = useRef(getCurrentData);
  fetchFnRef.current = fetchFn;
  updateStoreRef.current = updateStore;
  transformPayloadRef.current = transformPayload;
  getCurrentDataRef.current = getCurrentData;

  // Track state for race condition prevention
  const isFetchingRef = useRef(false);
  const lastUpdateTimestampRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to realtime updates
  useRealtimeSubscription<Record<string, unknown>>({
    table,
    filter: recordId ? `id=eq.${recordId}` : undefined,
    enabled: enabled && !!recordId,
    onUpdate: (record) => {
      // Extract timestamp from record if available (updated_at column)
      const recordUpdatedAt = record?.updated_at 
        ? new Date(record.updated_at as string).getTime() 
        : Date.now();
      
      // Skip if this update is older than our last processed update
      if (recordUpdatedAt < lastUpdateTimestampRef.current) {
        return;
      }
      
      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // FAST PATH: Try to transform payload directly without fetch
      if (transformPayloadRef.current && record) {
        const currentData = getCurrentDataRef.current?.() ?? null;
        const transformedData = transformPayloadRef.current(record, currentData);
        
        if (transformedData !== null) {
          // Success! Update store immediately without fetch
          lastUpdateTimestampRef.current = Date.now();
          const store = useCopilotActiveContextStore.getState();
          updateStoreRef.current(store, transformedData);
          return;
        }
        // Fall through to fetch path if transform returned null
      }
      
      // SLOW PATH: Fetch full data
      // Debounce: wait before fetching to batch rapid updates
      debounceTimerRef.current = setTimeout(() => {
        // Skip if already fetching
        if (isFetchingRef.current) return;
        
        isFetchingRef.current = true;
        lastUpdateTimestampRef.current = Date.now();
        
        // Fetch full transformed data and update store
        fetchFnRef.current()
          .then((data) => {
            const store = useCopilotActiveContextStore.getState();
            updateStoreRef.current(store, data);
          })
          .catch(() => { /* Silent fail */ })
          .finally(() => {
            isFetchingRef.current = false;
          });
      }, debounceMs);
    },
  });
}

// ============================================================================
// Convenience Hooks - Type-safe wrappers for specific domains
// ============================================================================

/**
 * Realtime sync for workout programs → copilot-active-context.
 * 
 * FAST PATH: Transforms Realtime payload directly (no fetch needed!)
 * The payload contains `weeks` JSON which we merge with current program.
 */
export function useWorkoutCopilotRealtimeSync(config: {
  programId: string | undefined | null;
  enabled?: boolean;
}): void {
  useCopilotRealtimeSync({
    table: 'workout_programs',
    recordId: config.programId,
    enabled: config.enabled,
    
    // FAST PATH: Transform Realtime payload directly
    transformPayload: (payload, currentProgram) => {
      // If no current program in store, can't merge - fall back to fetch
      if (!currentProgram) return null;
      
      // The payload contains updated columns in snake_case
      // We only need `weeks` which is already a JSON array
      const updatedWeeks = payload.weeks;
      if (!updatedWeeks) return null;
      
      // Merge updated weeks into current program (instant update!)
      return {
        ...currentProgram,
        weeks: updatedWeeks,
        updatedAt: payload.updated_at ? new Date(payload.updated_at as string) : new Date(),
      } as typeof currentProgram;
    },
    
    // Get current program from store for merging
    getCurrentData: () => {
      const store = useCopilotActiveContextStore.getState();
      return store.workout?.program ?? null;
    },
    
    // SLOW PATH fallback: Fetch full data if transform fails
    fetchFn: async () => {
      const response = await fetch(`/api/workouts/${config.programId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.program;
    },
    
    updateStore: (store, data) => store.updateWorkoutProgram(data),
  });
}

/**
 * Realtime sync for nutrition plans → copilot-active-context.
 * 
 * FAST PATH: Transforms Realtime payload directly (no fetch needed!)
 * The payload contains `days` JSON which we merge with current plan.
 */
export function useNutritionCopilotRealtimeSync(config: {
  planId: string | undefined | null;
  enabled?: boolean;
}): void {
  useCopilotRealtimeSync({
    table: 'nutrition_plans',
    recordId: config.planId,
    enabled: config.enabled,
    
    // FAST PATH: Transform Realtime payload directly
    transformPayload: (payload, currentPlan) => {
      if (!currentPlan) return null;
      
      // The payload contains `days` which is the main content
      const updatedDays = payload.days;
      if (!updatedDays) return null;
      
      return {
        ...currentPlan,
        days: updatedDays,
        updatedAt: payload.updated_at ? new Date(payload.updated_at as string) : new Date(),
      } as typeof currentPlan;
    },
    
    getCurrentData: () => {
      const store = useCopilotActiveContextStore.getState();
      return store.nutrition?.plan ?? null;
    },
    
    fetchFn: async () => {
      const response = await fetch(`/api/nutrition/${config.planId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.plan;
    },
    
    updateStore: (store, data) => store.updateNutritionPlan(data),
  });
}

/**
 * Realtime sync for OneAgenda projects → copilot-active-context.
 * 
 * FAST PATH: Transforms Realtime payload directly (no fetch needed!)
 * The payload contains `data` JSON with project structure.
 */
export function useOneAgendaCopilotRealtimeSync(config: {
  projectId: string | undefined | null;
  enabled?: boolean;
}): void {
  useCopilotRealtimeSync({
    table: 'oneagenda_projects',
    recordId: config.projectId,
    enabled: config.enabled,
    
    // FAST PATH: Transform Realtime payload directly
    transformPayload: (payload, currentData) => {
      if (!currentData) return null;
      
      // The payload contains the updated project data
      // For OneAgenda, we use the payload directly since it's the project record
      if (!payload.id) return null;
      
      // Reconstruct the project from payload
      // Note: tasks/milestones might be in separate tables, so fall back to fetch if missing
      return {
        project: {
          ...currentData.project,
          name: payload.name ?? currentData.project?.name,
          description: payload.description ?? currentData.project?.description,
          data: payload.data ?? currentData.project?.data,
          updatedAt: payload.updated_at ? new Date(payload.updated_at as string) : new Date(),
        },
        tasks: currentData.tasks,
        milestones: currentData.milestones,
      } as typeof currentData;
    },
    
    getCurrentData: () => {
      const store = useCopilotActiveContextStore.getState();
      const ctx = store.oneAgenda;
      return ctx ? { project: ctx.project, tasks: ctx.tasks, milestones: ctx.milestones } : null;
    },
    
    fetchFn: async () => {
      const response = await fetch(`/api/projects/${config.projectId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return { project: data.project, tasks: data.tasks ?? [], milestones: data.milestones ?? [] };
    },
    
    updateStore: (store, data) => store.updateOneAgendaProject(data.project, data.tasks, data.milestones),
  });
}

