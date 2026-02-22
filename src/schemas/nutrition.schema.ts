/**
 * Nutrition Schemas (shared)
 *
 * Re-exports the canonical schemas from @giulio-leone/schemas
 * Uses the pattern-based schemas for nutrition generation
 */

import { z } from 'zod';
import {
  // Core schemas
  MacrosSchema,
  CompleteMacrosSchema,
  MealTypeSchema,

  // Pattern-based schemas (primary)
  PatternNutritionGenerationInputSchema,
  PatternNutritionGenerationOutputSchema,
  PatternBasedNutritionPlanSchema,
  DayPatternSchema,
  MealWithVariantsSchema,
  PatternFoodSchema,
  FoodSwapSchema,
  FoodSelectionOutputSchema,
  MacroDistributionOutputSchema,
  MealPatternOutputSchema,
  AssembledDaySchema,
  AssembledWeekSchema,

  // User profile
  NutritionUserProfileSchema,

  // AI Generation Schemas (New P3.2)
  AIMacrosSchema,
  AIFoodItemSchema,
} from '@giulio-leone/schemas';

// Re-export pattern-based schemas
export {
  // Core
  MacrosSchema,
  CompleteMacrosSchema,
  MealTypeSchema,

  // AI Generation Schemas (New P3.2)
  AIMacrosSchema,
  AIFoodItemSchema,

  // Pattern generation (primary API)
  PatternNutritionGenerationInputSchema,
  PatternNutritionGenerationOutputSchema,
  PatternBasedNutritionPlanSchema,

  // Pattern components
  DayPatternSchema,
  MealWithVariantsSchema,
  PatternFoodSchema,
  FoodSwapSchema,
  AssembledDaySchema,
  AssembledWeekSchema,

  // Agent outputs
  FoodSelectionOutputSchema,
  MacroDistributionOutputSchema,
  MealPatternOutputSchema,
  AIFoodItemSchema as LegacyAIFoodItemSchema, // Backwards compatibility if needed, though canonical is preferred

  // User profile
  NutritionUserProfileSchema,
};

// Type exports
export type Macros = z.infer<typeof MacrosSchema>;
export type CompleteMacros = z.infer<typeof CompleteMacrosSchema>;
export type MealType = z.infer<typeof MealTypeSchema>;

export type PatternNutritionGenerationInput = z.infer<typeof PatternNutritionGenerationInputSchema>;
export type PatternNutritionGenerationOutput = z.infer<
  typeof PatternNutritionGenerationOutputSchema
>;
export type PatternBasedNutritionPlan = z.infer<typeof PatternBasedNutritionPlanSchema>;
export type DayPattern = z.infer<typeof DayPatternSchema>;
export type MealWithVariants = z.infer<typeof MealWithVariantsSchema>;
export type PatternFood = z.infer<typeof PatternFoodSchema>;
export type FoodSwap = z.infer<typeof FoodSwapSchema>;
export type AssembledDay = z.infer<typeof AssembledDaySchema>;
export type AssembledWeek = z.infer<typeof AssembledWeekSchema>;

export type FoodSelectionOutput = z.infer<typeof FoodSelectionOutputSchema>;
export type MacroDistributionOutput = z.infer<typeof MacroDistributionOutputSchema>;
export type MealPatternOutput = z.infer<typeof MealPatternOutputSchema>;
export type AIFoodItem = z.infer<typeof AIFoodItemSchema>;

export type NutritionUserProfile = z.infer<typeof NutritionUserProfileSchema>;
