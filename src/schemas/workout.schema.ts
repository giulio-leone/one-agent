/**
 * OneAgent SDK 4.2 - Workout Schemas
 *
 * Re-export da @giulio-leone/schemas per compatibilità.
 * SSOT è in packages/schemas/src/workout/index.ts
 */

export {
  // Base Schemas
  exerciseSetSchema as ExerciseSetSchema,
  setProgressionSchema as SetProgressionSchema,
  setGroupSchema as SetGroupSchema,
  exerciseSchema as ExerciseSchema,
  workoutDaySchema as WorkoutDaySchema,
  workoutWeekSchema as WeeklyWorkoutPlanSchema,
  workoutProgramSchema as WorkoutProgramSchema,
  // AI Generation Schemas
  aiSetGroupSchema as AISetGroupSchema,
  aiExerciseSchema as AIExerciseSchema,
  aiWorkoutDaySchema as AIWorkoutDaySchema,
  aiWorkoutWeekSchema as AIWeeklyWorkoutPlanSchema,
  aiWorkoutProgramSchema as AIWorkoutProgramSchema,
  // Agent Output Schemas
  exerciseSelectionOutputSchema,
  workoutPlanningOutputSchema,
  // Input Schemas
  workoutUserProfileSchema as WorkoutUserProfileSchema,
  workoutGoalsSchema as WorkoutGoalsSchema,
  oneRepMaxDataSchema as OneRepMaxDataSchema,
  workoutGenerationInputSchema as WorkoutGenerationInputSchema,
  // Tipi
  type ExerciseSet,
  type SetProgression,
  type SetGroup,
  type Exercise,
  type WorkoutDay,
  type WorkoutWeek as WeeklyWorkoutPlan,
  type WorkoutProgram,
  type AISetGroup,
  type AIExercise,
  type AIWorkoutDay,
  type AIWorkoutWeek as AIWeeklyWorkoutPlan,
  type AIWorkoutProgram,
  type ExerciseSelectionOutput,
  type WorkoutPlanningOutput,
  type WorkoutUserProfile,
  type WorkoutGoals,
  type OneRepMaxData,
  type WorkoutGenerationInput,
} from '@giulio-leone/schemas';

import { z } from 'zod';

/**
 * Full WorkoutProgram schema for AI generation output (with metadata)// Deprecated schemas removed. Use @giulio-leone/schemas directly.
 */
export const FullWorkoutProgramSchema = z.lazy(() => {
  const { workoutProgramSchema } = require('@giulio-leone/schemas');
  return workoutProgramSchema;
});

export type FullWorkoutProgram = z.infer<typeof FullWorkoutProgramSchema>;

/**
 * Workout generation output schema
 */
export const WorkoutGenerationOutputSchema = z.object({
  program: z.any(), // Will be validated by FullWorkoutProgramSchema
  summary: z.string().min(1),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()),
  generatedAt: z.coerce.date(),
  tokensUsed: z.number().min(0),
  costUSD: z.number().min(0),
});

export type WorkoutGenerationOutput = z.infer<typeof WorkoutGenerationOutputSchema>;
