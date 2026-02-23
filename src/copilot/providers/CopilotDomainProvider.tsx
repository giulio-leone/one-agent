/**
 * CopilotDomainProvider
 *
 * Provider component that automatically syncs parent-level context to the
 * Copilot active context store. Use this at the top of domain pages to
 * initialize the context.
 *
 * USAGE:
 * ```tsx
 * // In WorkoutBuilderPage
 * <CopilotDomainProvider
 *   domain="workout"
 *   workoutData={{ programId, program }}
 *   onDataChange={handleSave}
 * >
 *   <WorkoutVisualBuilder />
 * </CopilotDomainProvider>
 * ```
 *
 * @module lib-copilot/providers/CopilotDomainProvider
 */

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  useCopilotActiveContextStore,
  type ActiveDomain,
} from '@giulio-leone/lib-stores';
import type { WorkoutProgram } from '@giulio-leone/types/workout';
import type { NutritionPlan } from '@giulio-leone/types/nutrition';

// ============================================================================
// Types
// ============================================================================

export interface WorkoutDomainData {
  programId: string;
  program: WorkoutProgram;
}

export interface NutritionDomainData {
  planId: string;
  plan: NutritionPlan;
}

export interface OneAgendaDomainData {
  projectId: string;
}

export type DomainData = WorkoutDomainData | NutritionDomainData | OneAgendaDomainData;

export interface CopilotDomainProviderProps {
  /** The domain type */
  domain: Exclude<ActiveDomain, null>;
  
  /** Workout domain data */
  workoutData?: WorkoutDomainData;
  
  /** Nutrition domain data */
  nutritionData?: NutritionDomainData;
  
  /** OneAgenda domain data */
  oneAgendaData?: OneAgendaDomainData;
  
  /** Callback when data changes (from AI operations) */
  onDataChange?: (data: unknown) => void;
  
  /** Children components */
  children: ReactNode;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * CopilotDomainProvider - Initializes and syncs domain context
 *
 * Automatically:
 * - Initializes the appropriate domain context on mount
 * - Updates the context when data changes
 * - Clears context on unmount
 *
 * @example
 * ```tsx
 * <CopilotDomainProvider
 *   domain="workout"
 *   workoutData={{ programId: id, program }}
 * >
 *   <WorkoutVisualBuilder />
 * </CopilotDomainProvider>
 * ```
 */
export function CopilotDomainProvider({
  domain,
  workoutData,
  nutritionData,
  oneAgendaData,
  onDataChange,
  children,
}: CopilotDomainProviderProps) {
  // Get store actions
  const initWorkoutContext = useCopilotActiveContextStore((s) => s.initWorkoutContext);
  const updateWorkoutProgram = useCopilotActiveContextStore((s) => s.updateWorkoutProgram);
  const initNutritionContext = useCopilotActiveContextStore((s) => s.initNutritionContext);
  const updateNutritionPlan = useCopilotActiveContextStore((s) => s.updateNutritionPlan);
  const initOneAgendaContext = useCopilotActiveContextStore((s) => s.initOneAgendaContext);
  const clearContext = useCopilotActiveContextStore((s) => s.clearContext);

  // Track if we've initialized to avoid duplicate inits
  const initializedRef = useRef(false);
  
  // Store onDataChange callback ref
  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  // Initialize context on mount based on domain
  useEffect(() => {
    if (initializedRef.current) return;
    
    switch (domain) {
      case 'workout':
        if (workoutData) {
          initWorkoutContext(workoutData.programId, workoutData.program);
          initializedRef.current = true;
        }
        break;
        
      case 'nutrition':
        if (nutritionData) {
          initNutritionContext(nutritionData.planId, nutritionData.plan);
          initializedRef.current = true;
        }
        break;
        
      case 'oneagenda':
        if (oneAgendaData) {
          initOneAgendaContext(oneAgendaData.projectId);
          initializedRef.current = true;
        }
        break;
    }

    // Cleanup on unmount
    return () => {
      clearContext();
      initializedRef.current = false;
    };
  }, [
    domain,
    workoutData?.programId,
    nutritionData?.planId,
    oneAgendaData?.projectId,
    initWorkoutContext,
    initNutritionContext,
    initOneAgendaContext,
    clearContext,
  ]);

  // Sync data updates (when program/plan changes from external source)
  useEffect(() => {
    if (!initializedRef.current) return;
    
    switch (domain) {
      case 'workout':
        if (workoutData?.program) {
          updateWorkoutProgram(workoutData.program);
        }
        break;
        
      case 'nutrition':
        if (nutritionData?.plan) {
          updateNutritionPlan(nutritionData.plan);
        }
        break;
    }
  }, [domain, workoutData?.program, nutritionData?.plan, updateWorkoutProgram, updateNutritionPlan]);

  return <>{children}</>;
}

export default CopilotDomainProvider;
