/**
 * Analytics Context Builder
 *
 * Builds context for analytics copilot including recent metrics and snapshots.
 */

import { prisma } from '@giulio-leone/lib-core';
import type { CopilotContext } from './types';
import { getLatestBodyMeasurement } from '@giulio-leone/lib-core';
import { getLatestProgressSnapshot } from '@giulio-leone/lib-analytics/progress-snapshot.service';

/**
 * Build analytics context for copilot
 */
export async function buildAnalyticsContext(userId: string): Promise<CopilotContext> {
  // Get user profile
  const userProfile = await prisma.user_profiles.findUnique({
    where: { userId },
    select: {
      weightKg: true,
      heightCm: true,
      age: true,
      sex: true,
      activityLevel: true,
      trainingFrequency: true,
      equipment: true,
      workoutGoals: true,
      nutritionGoals: true,
      dietaryRestrictions: true,
      dietaryPreferences: true,
      healthNotes: true,
    },
  });

  if (!userProfile) {
    throw new Error('User profile not found');
  }

  // Get latest body measurement
  const latestBodyMeasurement = await getLatestBodyMeasurement(userId);

  // Get latest progress snapshot
  const latestSnapshot = await getLatestProgressSnapshot(userId);

  // Get recent workout sessions (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentWorkoutSessions = await prisma.workout_sessions.findMany({
    where: {
      userId,
      startedAt: { gte: sevenDaysAgo },
    },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      programId: true,
      weekNumber: true,
      dayNumber: true,
      startedAt: true,
      completedAt: true,
      exercises: true,
    },
  });

  // Get recent nutrition logs (last 7 days)
  const recentNutritionLogs = await prisma.nutrition_day_logs.findMany({
    where: {
      userId,
      date: { gte: sevenDaysAgo },
    },
    orderBy: { date: 'desc' },
    take: 7,
    select: {
      id: true,
      planId: true,
      date: true,
      weekNumber: true,
      dayNumber: true,
      actualDailyMacros: true,
      waterIntake: true,
    },
  });

  // Get active goals
  const activeGoals = await prisma.user_goals.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      type: true,
      target: true,
      deadline: true,
      startDate: true,
      progressLogs: true,
    },
  });

  // Get active nutrition plan
  const activeNutritionPlan = await prisma.nutrition_plans.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      goals: true,
      targetMacros: true,
      durationWeeks: true,
    },
  });

  // Get active workout program
  const activeWorkoutProgram = await prisma.workout_programs.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      goals: true,
      difficulty: true,
      durationWeeks: true,
    },
  });

  return {
    userProfile: {
      weightKg: userProfile.weightKg ? Number(userProfile.weightKg) : null,
      heightCm: userProfile.heightCm ? Number(userProfile.heightCm) : null,
      age: userProfile.age,
      sex: userProfile.sex,
      activityLevel: userProfile.activityLevel,
      trainingFrequency: userProfile.trainingFrequency,
      equipment: userProfile.equipment || [],
      workoutGoals: userProfile.workoutGoals || [],
      nutritionGoals: userProfile.nutritionGoals || [],
      dietaryRestrictions: userProfile.dietaryRestrictions || [],
      dietaryPreferences: userProfile.dietaryPreferences || [],
      healthNotes: userProfile.healthNotes || null,
    },
    currentSnapshot: latestSnapshot,
    latestBodyMeasurement,
    recentWorkoutSessions: recentWorkoutSessions.map((session) => ({
      id: session.id,
      programId: session.programId,
      weekNumber: session.weekNumber,
      dayNumber: session.dayNumber,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() || null,
      completed: session.completedAt !== null,
    })),
    recentNutritionLogs: recentNutritionLogs.map((log) => ({
      id: log.id,
      planId: log.planId,
      date: log.date.toISOString(),
      weekNumber: log.weekNumber,
      dayNumber: log.dayNumber,
      actualDailyMacros: log.actualDailyMacros,
      waterIntake: log.waterIntake ? Number(log.waterIntake) : null,
    })),
    activeGoals,
    activeNutritionPlan,
    activeWorkoutProgram,
    metadata: {
      contextType: 'analytics',
      timestamp: new Date().toISOString(),
    },
  };
}
