/**
 * Copilot Context Builder
 *
 * Costruisce il contesto completo per i copilot AI includendo:
 * - Piano/programma corrente
 * - Profilo utente
 * - Ultimi 2-3 piani/programmi precedenti
 * - Metadati utili
 *
 * Refactored to use centralized utilities following DRY principle
 */

import { prisma } from '@giulio-leone/lib-core';
import { normalizeNutritionPlan, resolveFoodReferences } from '@giulio-leone/one-nutrition';
import { buildUserProfileData, USER_PROFILE_SELECT } from './user-profile-builder';
import { userMemoryService } from '@giulio-leone/lib-core';
import type { WorkoutProgram } from '@giulio-leone/types';

const CHAT_CONSTANTS = {
  RECENT_ITEMS_TAKE: 3,
};

/**
 * Recent exercise structure for context
 */
import type { CopilotContext } from './types';

/**
 * Costruisce il contesto per il copilot nutrizionale
 */
export async function buildNutritionContext(
  userId: string,
  planId: string
): Promise<CopilotContext> {
  // Carica il piano corrente
  const currentPlan = await prisma.nutrition_plans.findUnique({
    where: { id: planId },
  });

  if (!currentPlan || currentPlan.userId !== userId) {
    throw new Error('Piano non trovato o non autorizzato');
  }

  const normalizedPlan = normalizeNutritionPlan(
    currentPlan as Parameters<typeof normalizeNutritionPlan>[0]
  );
  // Risolvi foodItemId in dati completi per UI/API
  const resolvedPlan = await resolveFoodReferences(normalizedPlan);

  // Carica il profilo utente
  const profile = await prisma.user_profiles.findUnique({
    where: { userId },
    select: USER_PROFILE_SELECT,
  });

  // Carica gli ultimi 2-3 piani nutrizionali (escludendo quello corrente)
  const recentPlans = await prisma.nutrition_plans.findMany({
    where: {
      userId,
      id: { not: planId },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: CHAT_CONSTANTS.RECENT_ITEMS_TAKE,
  });

  const normalizedRecentPlans = await Promise.all(
    recentPlans.map((plan) =>
      resolveFoodReferences(
        normalizeNutritionPlan(plan as Parameters<typeof normalizeNutritionPlan>[0])
      )
    )
  );

  // Get user memory context
  const memoryContext = await userMemoryService.getMemoryContext(userId, 'nutrition');

  return {
    currentPlan: resolvedPlan,
    userProfile: buildUserProfileData(profile),
    recentPlans: normalizedRecentPlans,
    userMemory: {
      patterns: memoryContext.relevantPatterns,
      insights: memoryContext.relevantInsights,
      recommendations: memoryContext.recommendations,
    },
    metadata: {
      planVersion: currentPlan.version,
      planCreatedAt: currentPlan.createdAt.toISOString(),
      planUpdatedAt: currentPlan.updatedAt.toISOString(),
    },
  };
}

/**
 * Costruisce il contesto per il copilot workout
 */
export async function buildWorkoutContext(
  userId: string,
  programId: string
): Promise<CopilotContext> {
  // Carica il programma corrente
  const currentProgram = await prisma.workout_programs.findUnique({
    where: { id: programId },
  });

  if (!currentProgram || currentProgram.userId !== userId) {
    throw new Error('Programma non trovato o non autorizzato');
  }

  // Normalizza il programma (se necessario, altrimenti usa direttamente)
  const normalizedProgram = currentProgram as WorkoutProgram;

  // Carica il profilo utente
  const profile = await prisma.user_profiles.findUnique({
    where: { userId },
    select: USER_PROFILE_SELECT,
  });

  // Carica gli ultimi 2-3 programmi di allenamento (escludendo quello corrente)
  const recentPrograms = await prisma.workout_programs.findMany({
    where: {
      userId,
      id: { not: programId },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: CHAT_CONSTANTS.RECENT_ITEMS_TAKE,
  });

  const normalizedRecentPrograms = recentPrograms as WorkoutProgram[];

  // Get user memory context
  const memoryContext = await userMemoryService.getMemoryContext(userId, 'workout');

  return {
    currentPlan: normalizedProgram,
    userProfile: buildUserProfileData(profile),
    recentPrograms: normalizedRecentPrograms,
    userMemory: {
      patterns: memoryContext.relevantPatterns,
      insights: memoryContext.relevantInsights,
      recommendations: memoryContext.recommendations,
    },
    metadata: {
      planVersion: currentProgram.version,
      planCreatedAt: currentProgram.createdAt.toISOString(),
      planUpdatedAt: currentProgram.updatedAt.toISOString(),
    },
  };
}

/**
 * Costruisce il contesto per il copilot chat generale
 */
export async function buildChatContext(
  userId: string
): Promise<Omit<CopilotContext, 'currentPlan'>> {
  // Carica il profilo utente
  const profile = await prisma.user_profiles.findUnique({
    where: { userId },
    select: USER_PROFILE_SELECT,
  });

  // Carica gli ultimi 2-3 piani nutrizionali
  const recentPlans = await prisma.nutrition_plans.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: CHAT_CONSTANTS.RECENT_ITEMS_TAKE,
  });

  // Carica gli ultimi 2-3 programmi di allenamento
  const recentPrograms = await prisma.workout_programs.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: CHAT_CONSTANTS.RECENT_ITEMS_TAKE,
  });

  const normalizedRecentPlans = recentPlans.map((plan) =>
    normalizeNutritionPlan(plan as Parameters<typeof normalizeNutritionPlan>[0])
  );
  const normalizedRecentPrograms = recentPrograms as WorkoutProgram[];

  // Get user memory context (all domains)
  const memoryContext = await userMemoryService.getMemoryContext(userId);

  return {
    userProfile: buildUserProfileData(profile),
    recentPlans: normalizedRecentPlans,
    recentPrograms: normalizedRecentPrograms,
    userMemory: {
      patterns: memoryContext.relevantPatterns,
      insights: memoryContext.relevantInsights,
      recommendations: memoryContext.recommendations,
    },
    metadata: {},
  };
}

// Re-export exercise context builder for convenience
export { buildExerciseContext } from './exercise-context-builder';
