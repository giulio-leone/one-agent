/**
 * Exercise Context Builder
 *
 * Builds context for exercise copilot including user profile,
 * recent exercises, and available equipment.
 */

import { prisma } from '@giulio-leone/lib-core';
import { buildUserProfileData, USER_PROFILE_SELECT } from './user-profile-builder';
import type { CopilotContext } from './types';

const CHAT_CONSTANTS = {
  RECENT_ITEMS_TAKE: 3,
};

/**
 * Builds context for exercise copilot
 */
export async function buildExerciseContext(userId: string): Promise<CopilotContext> {
  // Load user profile
  const profile = await prisma.user_profiles.findUnique({
    where: { userId },
    select: USER_PROFILE_SELECT,
  });

  if (!profile) {
    throw new Error('User profile not found');
  }

  const userProfile = buildUserProfileData(profile);

  // Load recent exercises (created by user or approved)
  const recentExercises = await prisma.exercises.findMany({
    where: {
      OR: [{ createdById: userId }, { approvalStatus: 'APPROVED' }],
    },
    orderBy: { updatedAt: 'desc' },
    take: CHAT_CONSTANTS.RECENT_ITEMS_TAKE,
    select: {
      id: true,
      slug: true,
      exercise_translations: {
        where: { locale: 'en' },
        select: { name: true },
      },
      exercise_muscles: {
        include: {
          muscles: {
            select: { id: true, name: true },
          },
        },
      },
      exercise_equipments: {
        include: {
          equipments: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Format recent exercises for context
  const formattedRecentExercises = recentExercises.map((exercise: any) => ({
    id: exercise.id,
    slug: exercise.slug,
    name: exercise.exercise_translations[0]?.name || exercise.slug,
    muscles: exercise.exercise_muscles.map((m: any) => ({
      id: m.muscles.id,
      name: m.muscles.name,
      role: m.role,
    })),
    equipment: exercise.exercise_equipments.map((e: any) => ({
      id: e.equipments.id,
      name: e.equipments.name,
    })),
  }));

  return {
    userProfile,
    recentExercises: formattedRecentExercises,
    metadata: {
      timestamp: new Date().toISOString(),
      contextType: 'exercises',
    },
  };
}
