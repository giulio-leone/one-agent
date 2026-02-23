/**
 * Modification Detector
 *
 * Detects if a user message is requesting a modification to existing plan/program.
 * Extracted from copilot route (lines 500-530) following SRP.
 */

/**
 * Modification detection result
 */
export interface ModificationDetection {
  isModification: boolean;
  type?: 'nutrition' | 'workout';
  dayNumber?: number;
  weekNumber?: number;
}

/**
 * Italian keywords that indicate modification intent
 */
const MODIFICATION_KEYWORDS = [
  'modifica',
  'cambia',
  'sostituisci',
  'aggiungi',
  'rimuovi',
  'elimina',
  'aggiorna',
  'correggi',
  'migliora',
  'adatta',
] as const;

/**
 * Day-related keywords
 * Note: Currently unused but kept for future keyword matching
 */
export const DAY_KEYWORDS = ['giorno', 'day', 'giornata'] as const;

/**
 * Week-related keywords
 * Note: Currently unused but kept for future keyword matching
 */
export const WEEK_KEYWORDS = ['settimana', 'week'] as const;

/**
 * Meal-related keywords (indicates nutrition modification)
 */
const MEAL_KEYWORDS = [
  'pasto',
  'meal',
  'colazione',
  'pranzo',
  'cena',
  'spuntino',
  'alimento',
  'cibo',
] as const;

/**
 * Exercise-related keywords (indicates workout modification)
 */
const EXERCISE_KEYWORDS = [
  'esercizio',
  'exercise',
  'allenamento',
  'workout',
  'set',
  'serie',
  'ripetizioni',
  'rep',
] as const;

/**
 * Detects if message is requesting a modification
 *
 * @param message - User message
 * @returns Detection result with type and target (day/week number)
 *
 * @example
 * ```typescript
 * const result = detectModificationRequest("Modifica il giorno 2 del piano");
 * // { isModification: true, type: 'nutrition', dayNumber: 2 }
 * ```
 */
export function detectModificationRequest(message: string): ModificationDetection {
  const lowerMessage = message.toLowerCase();

  // Check if message contains modification keywords
  const hasModificationKeyword = MODIFICATION_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  if (!hasModificationKeyword) {
    return { isModification: false };
  }

  // Determine type based on context keywords
  const hasMealKeyword = MEAL_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
  const hasExerciseKeyword = EXERCISE_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));

  let type: 'nutrition' | 'workout' | undefined;
  if (hasMealKeyword && !hasExerciseKeyword) {
    type = 'nutrition';
  } else if (hasExerciseKeyword && !hasMealKeyword) {
    type = 'workout';
  }

  // Extract day number (for nutrition)
  const dayMatch =
    lowerMessage.match(/giorn(?:o|ata)?\s*(\d+)/i) || lowerMessage.match(/day\s*(\d+)/i);
  const dayNumber = dayMatch && dayMatch[1] ? parseInt(dayMatch[1], 10) : undefined;

  // Extract week number (for workout)
  const weekMatch =
    lowerMessage.match(/settiman[ae]\s*(\d+)/i) || lowerMessage.match(/week\s*(\d+)/i);
  const weekNumber = weekMatch && weekMatch[1] ? parseInt(weekMatch[1], 10) : undefined;

  return {
    isModification: true,
    type,
    dayNumber,
    weekNumber,
  };
}

/**
 * Checks if message is specifically a nutrition day modification
 */
export function isNutritionDayModification(message: string): boolean {
  const detection = detectModificationRequest(message);
  return detection.isModification && detection.type === 'nutrition' && !!detection.dayNumber;
}

/**
 * Checks if message is specifically a workout week modification
 */
export function isWorkoutWeekModification(message: string): boolean {
  const detection = detectModificationRequest(message);
  return detection.isModification && detection.type === 'workout' && !!detection.weekNumber;
}

/**
 * Extracts day number from message (workout-specific)
 */
export function extractWorkoutDayNumber(message: string): number | null {
  const detection = detectModificationRequest(message);
  return detection.dayNumber ?? null;
}

/**
 * Extracts week number from message
 */
export function extractWeekNumber(message: string): number | null {
  const detection = detectModificationRequest(message);
  return detection.weekNumber ?? null;
}
