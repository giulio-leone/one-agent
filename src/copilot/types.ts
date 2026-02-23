/**
 * Copilot Context Types
 *
 * Shared interfaces for Copilot context builders
 */
import type { NutritionPlan } from '@giulio-leone/types';
import type { WorkoutProgram } from '@giulio-leone/types';
import type { UserProfileData } from './user-profile-builder';

/**
 * Recent exercise structure for context
 */
export interface RecentExercise {
  id: string;
  slug: string;
  name: string;
  muscles: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  equipment: Array<{
    id: string;
    name: string;
  }>;
}

export interface CopilotContext {
  currentPlan?: NutritionPlan | WorkoutProgram;
  userProfile: UserProfileData;
  recentPlans?: NutritionPlan[];
  recentPrograms?: WorkoutProgram[];
  recentExercises?: RecentExercise[];
  // User memory for personalization
  userMemory?: {
    patterns: Array<{
      type: string;
      description: string;
      confidence: number;
      suggestions?: string[];
    }>;
    insights: Array<{
      category: string;
      insight: string;
      basedOn: string;
      confidence: number;
    }>;
    recommendations: Array<{
      type: string;
      message: string;
      priority: number;
    }>;
  };
  // Analytics-specific properties (optional, only present when built from buildAnalyticsContext)
  latestBodyMeasurement?: unknown;
  currentSnapshot?: unknown;
  recentWorkoutSessions?: Array<{
    id: string;
    programId: string;
    weekNumber: number;
    dayNumber: number;
    startedAt: string;
    completedAt: string | null;
    completed: boolean;
  }>;
  recentNutritionLogs?: Array<{
    id: string;
    planId: string;
    date: string;
    weekNumber: number;
    dayNumber: number;
    actualDailyMacros: unknown;
    waterIntake: number | null;
  }>;
  activeGoals?: unknown[];
  activeNutritionPlan?: {
    id: string;
    name: string;
    goals: string[];
    targetMacros: unknown;
    durationWeeks: number;
  } | null;
  activeWorkoutProgram?: {
    id: string;
    name: string;
    goals: string[];
    difficulty: string;
    durationWeeks: number;
  } | null;
  metadata: {
    planVersion?: number;
    planCreatedAt?: string;
    planUpdatedAt?: string;
    contextType?: string;
    timestamp?: string;
  };
}
