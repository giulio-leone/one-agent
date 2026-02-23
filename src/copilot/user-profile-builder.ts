/**
 * User Profile Builder Utility
 *
 * Centralizes user profile data extraction and normalization.
 * Eliminates 60+ lines of duplicated code from context-builder.ts
 *
 * Following DRY principle - used by:
 * - buildNutritionContext()
 * - buildWorkoutContext()
 * - buildChatContext()
 * - buildExerciseContext()
 */

/**
 * Prisma select statement for user_profiles queries
 *
 * NOTE: Escludo dietType perché la colonna non esiste ancora nel database di produzione
 * TODO: Aggiungere 'dietType: true' quando le migrazioni saranno applicate
 */
export const USER_PROFILE_SELECT = {
  id: true,
  userId: true,
  age: true,
  sex: true,
  heightCm: true,
  weightKg: true,
  activityLevel: true,
  trainingFrequency: true,
  dailyCalories: true,
  workoutGoal: true,
  equipment: true,
  dietaryRestrictions: true,
  dietaryPreferences: true,
  // dietType: true, // TODO: uncomment quando migrazione applicata
  healthNotes: true,
  createdAt: true,
  updatedAt: true,
  weightUnit: true,
  workoutGoals: true,
  nutritionGoals: true,
} as const;

/**
 * User profile data structure for copilot context
 */
export interface UserProfileData {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  trainingFrequency: number | null;
  nutritionGoals: string[]; // Array of NutritionGoal IDs (CUIDs)
  workoutGoals: string[]; // Array of WorkoutGoal IDs
  dietaryRestrictions: string[];
  dietaryPreferences: string[];
  equipment: string[];
  healthNotes: string | null;
}

import type { Prisma } from '@prisma/client';
type Decimal = Prisma.Decimal;

/**
 * Minimal user profile type (compatible with Prisma select)
 */
export interface MinimalUserProfile {
  age?: number | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | string | Decimal | null;
  activityLevel?: string | null;
  trainingFrequency?: number | null;
  nutritionGoals?: string[] | null; // Array of NutritionGoal IDs (CUIDs)
  workoutGoals?: string[] | null; // Array of WorkoutGoal IDs
  dietaryRestrictions?: string[] | null;
  dietaryPreferences?: string[] | null;
  equipment?: string[] | null;
  healthNotes?: string | null;
}

/**
 * Builds normalized user profile data from database profile
 *
 * Handles type conversions, null safety, and default values.
 * Centralizes logic that was duplicated 3 times in context-builder.ts
 *
 * @param profile - User profile from database (can be partial or null)
 * @returns Normalized user profile data
 *
 * @example
 * ```typescript
 * const _profile = await prisma.userProfile.findUnique({ where: { userId } });
 * const profileData = buildUserProfileData(profile);
 * ```
 */
export function buildUserProfileData(
  profile: MinimalUserProfile | null | undefined
): UserProfileData {
  return {
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ? Number(profile.weightKg) : null,
    activityLevel: profile?.activityLevel ?? null,
    trainingFrequency: profile?.trainingFrequency ?? null,
    nutritionGoals: Array.isArray(profile?.nutritionGoals) ? profile.nutritionGoals : [],
    workoutGoals: Array.isArray(profile?.workoutGoals) ? profile.workoutGoals : [],
    dietaryRestrictions: profile?.dietaryRestrictions ?? [],
    dietaryPreferences: profile?.dietaryPreferences ?? [],
    equipment: profile?.equipment ?? [],
    healthNotes: profile?.healthNotes ?? null,
  };
}

/**
 * Extracts specific fields from user profile for exercise context
 *
 * Used when only equipment and workout-related data is needed.
 *
 * @param profile - User profile from database
 * @returns Exercise-specific profile data
 */
export function buildExerciseProfileData(profile: MinimalUserProfile | null | undefined) {
  return {
    equipment: profile?.equipment ?? [],
    workoutGoals: Array.isArray(profile?.workoutGoals) ? profile.workoutGoals : [],
    trainingFrequency: profile?.trainingFrequency ?? null,
  };
}

/**
 * Extracts specific fields from user profile for nutrition context
 *
 * Used when only nutrition-related data is needed.
 *
 * @param profile - User profile from database
 * @returns Nutrition-specific profile data
 */
export function buildNutritionProfileData(profile: MinimalUserProfile | null | undefined) {
  return {
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ? Number(profile.weightKg) : null,
    activityLevel: profile?.activityLevel ?? null,
    nutritionGoals: Array.isArray(profile?.nutritionGoals) ? profile.nutritionGoals : [],
    workoutGoals: Array.isArray(profile?.workoutGoals) ? profile.workoutGoals : [],
    dietaryRestrictions: profile?.dietaryRestrictions ?? [],
    dietaryPreferences: profile?.dietaryPreferences ?? [],
    healthNotes: profile?.healthNotes ?? null,
  };
}

/**
 * Extracts specific fields from user profile for workout context
 *
 * Used when only workout-related data is needed.
 *
 * @param profile - User profile from database
 * @returns Workout-specific profile data
 */
export function buildWorkoutProfileData(profile: MinimalUserProfile | null | undefined) {
  return {
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    trainingFrequency: profile?.trainingFrequency ?? null,
    workoutGoals: Array.isArray(profile?.workoutGoals) ? profile.workoutGoals : [],
    equipment: profile?.equipment ?? [],
  };
}
