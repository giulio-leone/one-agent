/**
 * useCopilotContextReporter Hook
 *
 * Provides a standardized interface for components to report their
 * active/selected state to the Copilot context store.
 *
 * USAGE:
 * ```tsx
 * const { reportSelection, reportHover, clearSelection } = useCopilotContextReporter('workout');
 *
 * <ExerciseCard
 *   onClick={() => reportSelection({ type: 'exercise', data: { index: i, id, name } })}
 *   onMouseEnter={() => reportHover({ type: 'exercise', indices: [i] })}
 *   onMouseLeave={() => reportHover(null)}
 * />
 * ```
 *
 * @module lib-copilot/hooks/useCopilotContextReporter
 */

'use client';

import { useCallback } from 'react';
import {
  useCopilotActiveContextStore,
  type SelectedExercise,
  type SelectedSetGroup,
  type SelectedMeal,
  type SelectedFood,
  type SelectedTask,
  type SelectedMilestone,
  type HoveredElement,
  type ActiveDomain,
} from '@giulio-leone/lib-stores';

// ============================================================================
// Types
// ============================================================================

/**
 * Selection types for workout domain
 */
export type WorkoutSelectionType = 'exercise' | 'setGroup';

/**
 * Selection types for nutrition domain
 */
export type NutritionSelectionType = 'meal' | 'food';

/**
 * Selection types for oneagenda domain
 */
export type OneAgendaSelectionType = 'task' | 'milestone';

/**
 * Selection payload for workout domain
 */
export type WorkoutSelectionPayload =
  | { type: 'exercise'; data: SelectedExercise }
  | { type: 'setGroup'; data: SelectedSetGroup };

/**
 * Selection payload for nutrition domain
 */
export type NutritionSelectionPayload =
  | { type: 'meal'; data: SelectedMeal }
  | { type: 'food'; data: SelectedFood };

/**
 * Selection payload for oneagenda domain
 */
export type OneAgendaSelectionPayload =
  | { type: 'task'; data: SelectedTask }
  | { type: 'milestone'; data: SelectedMilestone };

/**
 * Combined selection payload
 */
export type SelectionPayload =
  | WorkoutSelectionPayload
  | NutritionSelectionPayload
  | OneAgendaSelectionPayload;

// ============================================================================
// Hook Overloads
// ============================================================================

export interface UseCopilotContextReporterResult<TDomain extends ActiveDomain> {
  /**
   * Report a selection (e.g., user clicked on an exercise)
   */
  reportSelection: TDomain extends 'workout'
    ? (payload: WorkoutSelectionPayload | null) => void
    : TDomain extends 'nutrition'
    ? (payload: NutritionSelectionPayload | null) => void
    : TDomain extends 'oneagenda'
    ? (payload: OneAgendaSelectionPayload | null) => void
    : never;

  /**
   * Report a hover state (for quick actions)
   */
  reportHover: (element: HoveredElement | null) => void;

  /**
   * Clear all selections
   */
  clearSelection: () => void;

  /**
   * Check if something is selected
   */
  hasSelection: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for components to report their context state to Copilot
 *
 * @param domain - The current domain (workout, nutrition, oneagenda)
 * @returns Reporter functions for selection, hover, and clear
 *
 * @example
 * ```tsx
 * // In ExerciseCard
 * const { reportSelection, reportHover } = useCopilotContextReporter('workout');
 *
 * const handleClick = () => {
 *   reportSelection({
 *     type: 'exercise',
 *     data: { index: exerciseIndex, id: exercise.id, name: exercise.name }
 *   });
 * };
 * ```
 */
export function useCopilotContextReporter<TDomain extends Exclude<ActiveDomain, null>>(
  domain: TDomain
): UseCopilotContextReporterResult<TDomain> {
  // Get store actions
  const selectExercise = useCopilotActiveContextStore((s) => s.selectExercise);
  const selectSetGroup = useCopilotActiveContextStore((s) => s.selectSetGroup);
  const selectMeal = useCopilotActiveContextStore((s) => s.selectMeal);
  const selectFood = useCopilotActiveContextStore((s) => s.selectFood);
  const selectTask = useCopilotActiveContextStore((s) => s.selectTask);
  const selectMilestone = useCopilotActiveContextStore((s) => s.selectMilestone);
  const setWorkoutHover = useCopilotActiveContextStore((s) => s.setWorkoutHover);
  const setNutritionHover = useCopilotActiveContextStore((s) => s.setNutritionHover);

  // Get current selection state for hasSelection
  const workoutContext = useCopilotActiveContextStore((s) => s.workout);
  const nutritionContext = useCopilotActiveContextStore((s) => s.nutrition);
  const oneAgendaContext = useCopilotActiveContextStore((s) => s.oneAgenda);

  // Workout selection handler
  const reportWorkoutSelection = useCallback(
    (payload: WorkoutSelectionPayload | null) => {
      if (!payload) {
        selectExercise(null);
        selectSetGroup(null);
        return;
      }
      if (payload.type === 'exercise') {
        selectExercise(payload.data);
      } else if (payload.type === 'setGroup') {
        selectSetGroup(payload.data);
      }
    },
    [selectExercise, selectSetGroup]
  );

  // Nutrition selection handler
  const reportNutritionSelection = useCallback(
    (payload: NutritionSelectionPayload | null) => {
      if (!payload) {
        selectMeal(null);
        selectFood(null);
        return;
      }
      if (payload.type === 'meal') {
        selectMeal(payload.data);
      } else if (payload.type === 'food') {
        selectFood(payload.data);
      }
    },
    [selectMeal, selectFood]
  );

  // OneAgenda selection handler
  const reportOneAgendaSelection = useCallback(
    (payload: OneAgendaSelectionPayload | null) => {
      if (!payload) {
        selectTask(null);
        selectMilestone(null);
        return;
      }
      if (payload.type === 'task') {
        selectTask(payload.data);
      } else if (payload.type === 'milestone') {
        selectMilestone(payload.data);
      }
    },
    [selectTask, selectMilestone]
  );

  // Generic report selection based on domain
  const reportSelection = useCallback(
    (payload: SelectionPayload | null) => {
      switch (domain) {
        case 'workout':
          reportWorkoutSelection(payload as WorkoutSelectionPayload | null);
          break;
        case 'nutrition':
          reportNutritionSelection(payload as NutritionSelectionPayload | null);
          break;
        case 'oneagenda':
          reportOneAgendaSelection(payload as OneAgendaSelectionPayload | null);
          break;
      }
    },
    [domain, reportWorkoutSelection, reportNutritionSelection, reportOneAgendaSelection]
  );

  // Hover handler
  const reportHover = useCallback(
    (element: HoveredElement | null) => {
      switch (domain) {
        case 'workout':
          setWorkoutHover(element);
          break;
        case 'nutrition':
          setNutritionHover(element);
          break;
        // OneAgenda hover is different type, handle separately if needed
      }
    },
    [domain, setWorkoutHover, setNutritionHover]
  );

  // Clear all selections
  const clearSelection = useCallback(() => {
    reportSelection(null);
  }, [reportSelection]);

  // Compute hasSelection
  const hasSelection = (() => {
    switch (domain) {
      case 'workout':
        return !!(workoutContext?.selectedExercise || workoutContext?.selectedSetGroup);
      case 'nutrition':
        return !!(nutritionContext?.selectedMeal || nutritionContext?.selectedFood);
      case 'oneagenda':
        return !!(oneAgendaContext?.selectedTask || oneAgendaContext?.selectedMilestone);
      default:
        return false;
    }
  })();

  return {
    reportSelection,
    reportHover,
    clearSelection,
    hasSelection,
  } as UseCopilotContextReporterResult<TDomain>;
}

export default useCopilotContextReporter;
