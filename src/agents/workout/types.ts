/**
 * Workout Generation Types
 *
 * Type definitions for workout program generation.
 * Strongly typed for all agent inputs/outputs.
 */

import type { Checkpoint } from '../../mesh/types';
// Import shared types
import type { MuscleGroup } from "@giulio-leone/types-workout";
import type { Exercise as SharedExercise, WorkoutDay as SharedWorkoutDay, WorkoutWeek as SharedWorkoutWeek, WorkoutProgram as SharedWorkoutProgram, ExerciseSet as SharedExerciseSet, SetGroup as SharedSetGroup, ExerciseCategory as SharedExerciseCategory, DifficultyLevel as SharedDifficultyLevel } from "@giulio-leone/types-workout";

export type {
  SharedExercise,
  SharedWorkoutDay,
  SharedWorkoutWeek,
  SharedWorkoutProgram,
  SharedExerciseSet,
  SharedSetGroup,
  SharedExerciseCategory,
  SharedDifficultyLevel,
  MuscleGroup,
};

// ============================================================================
// Common Types
// ============================================================================

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  level(level: string, message: string, ...args: any[]): void;
}

export type Confidence = 'low' | 'medium' | 'high';
export type VolumeLevel = 'high' | 'moderate' | 'low';
export type IntensityLevel = 'high' | 'moderate' | 'high-moderate' | 'low';

/**
 * Standard Muscle Groups - Single Source of Truth
 * These names match the database seed and must be used consistently across all agents.
 */
export const STANDARD_MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Forearms',
] as const;

// Legacy lowercase muscle group type (kept for compatibility)
export type LegacyMuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'full-body';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type PrimaryGoal = 'strength' | 'hypertrophy' | 'endurance' | 'power' | 'general_fitness';
export type Goal = PrimaryGoal; // Alias for compatibility

export type TrainingPhase = 'accumulation' | 'intensification' | 'realization' | 'deload';
export type Phase = TrainingPhase; // Alias for compatibility
export type SplitType = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'bro_split' | 'custom';
export type ProgressionMethod =
  | 'linear'
  | 'double_progression'
  | 'wave_loading'
  | 'block_periodization';
// MuscleGroup imported from @giulio-leone/types
export type DifficultyLevel = SharedDifficultyLevel;
export type ExerciseCategory = SharedExerciseCategory;
export type WorkoutStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type WeightUnit = 'kg' | 'lbs' | 'bodyweight';

// ============================================================================
// Exercise Selection Agent Types
// ============================================================================

export interface SelectedExercise {
  name: string;
  exerciseId?: string;
  category: 'compound' | 'isolation' | 'cardio' | 'core' | 'mobility';
  targetMuscles: string[];
  equipment: string[];
  difficulty: ExperienceLevel;
  sets: number;
  reps: string | number;
  restSeconds: number;
  notes?: string;
}

export interface WeeklyStructure {
  splitType: SplitType;
  workouts: Array<{
    day: string;
    focus: string;
    exerciseNames: string[];
  }>;
}

// ============================================================================
// Workout Planning Agent Types
// ============================================================================

export interface Mesocycle {
  week: number;
  phase: TrainingPhase;
  description: string;
}

export interface ProgramStructure {
  name: string;
  splitType: SplitType;
  durationWeeks: number;
  mesocycles: Mesocycle[];
}

export interface ProgressionStrategy {
  method: ProgressionMethod;
  description: string;
  incrementPerWeek: string;
  deloadFrequency: string;
}

// ============================================================================
// Progression Agent Types
// ============================================================================

export interface StartingWeight {
  exercise: string;
  startingWeight: number;
  unit: WeightUnit;
  notes?: string;
}

export interface WeeklyProgression {
  week: number;
  phase: TrainingPhase;
  exercises: Array<{
    exercise: string;
    targetWeight: number;
    targetSets: number;
    targetReps: string | number;
    intensityPercent?: number;
    rpe?: number;
    notes?: string;
  }>;
}

export interface AutoRegulation {
  method: 'rpe' | 'rir' | 'percentage' | 'amrap';
  description: string;
  guidelines: string[];
}

// ============================================================================
// Personalization Types
// ============================================================================

export interface PersonalizedTip {
  category: string;
  tip: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PracticalAdvice {
  warmUpRoutine: string;
  coolDownRoutine: string;
  restDayActivities: string[];
  nutritionTips: string[];
  sleepRecommendations: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  recommendation: string;
}

// ============================================================================
// Main Input/Output Types
// ============================================================================

/**
 * Workout generation input
 */
export interface UserProfile {
  name?: string;
  weight: number; // kg
  height: number; // cm
  age: number;
  gender: 'male' | 'female' | 'other';
  experienceLevel: ExperienceLevel;
  currentLifts?: Record<string, number>; // Exercise name -> weight in kg
  injuries?: string[];
  fitnessLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
}

export interface WorkoutGoals {
  primary: PrimaryGoal;
  targetMuscles: string[];
  daysPerWeek: number; // 2-7
  duration: number; // weeks
  sessionDuration?: number; // minutes per session
}

export interface WorkoutConstraints {
  equipment: string[];
  location: 'gym' | 'home' | 'outdoor';
  timePerSession: number; // minutes
}

export interface WorkoutPreferences {
  preferredExercises?: string[];
  dislikedExercises?: string[];
  workoutTime?: 'morning' | 'afternoon' | 'evening';
}

export interface OneRepMaxRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  weightUnit: 'kg' | 'lbs';
  dateRecorded: Date;
  estimated: boolean;
}

export interface WorkoutGenerationInput {
  userId: string;
  userProfile: UserProfile;
  goals: WorkoutGoals;
  constraints: WorkoutConstraints;
  preferences?: WorkoutPreferences;
  additionalNotes?: string;
  availableExercises?: string[];
  oneRepMaxData?: OneRepMaxRecord[];
}

export interface GenerationMetadata {
  validationScore?: number;
  refinementPasses?: number;
}

/**
 * Workout generation output
 */
export interface WorkoutGenerationOutput {
  program: WorkoutProgram;
  tokensUsed: number;
  costUSD: number;
  generatedAt: Date;
  metadata?: GenerationMetadata;
}

export interface WorkoutProgramMetadata {
  generationMethod?: string;
  validationScore?: number;
  userProfile?: UserProfile;
  oneRepMaxData?: OneRepMaxRecord[];
  progressionStrategy?: ProgressionStrategy;
  startingWeights?: StartingWeight[];
  personalizedTips?: PersonalizedTip[];
  motivationalMessage?: string;
  practicalAdvice?: PracticalAdvice;
}

export interface WorkoutExerciseSet extends SharedExerciseSet {
  // Alias or extension
}

// Re-export shared types as aliases for agent specific names if used
export type WorkoutDay = SharedWorkoutDay;
export type WorkoutWeek = SharedWorkoutWeek;
export type WorkoutProgram = SharedWorkoutProgram;

// ============================================================================
// 1. INTAKE AGENT TYPES
// ============================================================================

export interface IntakeAgentInput {
  rawUserInput: string;
  existingProfile?: {
    userId: string;
    previousPrograms?: number;
    lastProgramDate?: Date;
  };
}

export interface AthleteBrief {
  // Core objective
  objective: Goal;
  specificGoal?: string; // "Add 20kg to squat", "Gain 5kg muscle"

  // Scheduling
  availability: {
    daysPerWeek: number;
    minutesPerSession: number;
    preferredDays?: string[];
  };

  // Duration
  durationWeeks: number;
  deadline?: Date; // Competition, event

  // Equipment & Location
  equipment: string[];
  trainingLocation: 'gym' | 'home' | 'hybrid';

  // Preferences
  preferences: {
    likedExercises: string[];
    dislikedExercises: string[];
    trainingStyle?: 'high_volume' | 'high_intensity' | 'balanced' | 'minimalist';
  };

  // Constraints
  constraints: {
    injuries: string[];
    limitations: string[];
    movementsToAvoid: string[];
  };

  // Metadata
  completeness: number; // 0-100
  missingInfo: string[];
}

export interface IntakeAgentOutput {
  brief: AthleteBrief;
  checkpoint: Checkpoint;
}

// ============================================================================
// 2. ATHLETE PROFILER TYPES
// ============================================================================

export interface AthleteProfilerInput {
  brief?: AthleteBrief; // Optional - may be undefined in parallel mode
  historicalData?: {
    previousPrograms?: Array<{
      duration: number;
      goal: Goal;
      completionRate: number;
      feedback?: string;
    }>;
    performanceTests?: Array<{
      exercise: string;
      weight: number;
      reps: number;
      date: Date;
    }>;
    bodyMetrics?: {
      weight: number;
      height: number;
      age: number;
      gender: 'male' | 'female';
    };
  };
}

export interface AthleteProfile {
  // Training background
  level: ExperienceLevel; // Using ExperienceLevel instead of local Level
  trainingAge: {
    years: number;
    confidence: Confidence;
  };

  // Capacity estimates
  volumeTolerance: {
    weeklySets: number; // Total sets/week tolerated
    confidence: Confidence;
  };
  intensityResponse: 'high_responder' | 'moderate' | 'low_responder' | 'unknown';
  recoveryCapacity: 'fast' | 'average' | 'slow' | 'unknown';

  // Physical profile
  injuryHistory: Array<{
    area: string;
    severity: 'minor' | 'moderate' | 'major';
    status: 'active' | 'resolved' | 'chronic';
  }>;
  biomechanics?: {
    leverages?: Record<string, 'short' | 'average' | 'long'>;
    mobilityLimitations?: string[];
  };

  // Lifestyle factors
  lifestyle: {
    sleepQuality: 'good' | 'average' | 'poor' | 'unknown';
    stressLevel: 'low' | 'moderate' | 'high' | 'unknown';
    nutritionStatus: 'optimal' | 'adequate' | 'suboptimal' | 'unknown';
  };

  // Estimated maxes (if available)
  estimatedMaxes?: Record<
    string,
    {
      value: number;
      unit: 'kg' | 'lbs';
      confidence: 'tested' | 'estimated' | 'unknown';
    }
  >;

  // Risk areas to monitor
  riskAreas: string[];
}

export interface AthleteProfilerOutput {
  profile: AthleteProfile;
  checkpoint: Checkpoint;
}

// ============================================================================
// 3. PERIODIZATION ARCHITECT TYPES
// ============================================================================

export interface PeriodizationInput {
  brief: AthleteBrief;
  profile: AthleteProfile;
}

export interface MacroPlan {
  totalWeeks: number;

  // Phases (mesocycles)
  phases: Array<{
    name: string;
    weekStart: number;
    weekEnd: number;
    focus: string[];
    volumeLevel: VolumeLevel;
    intensityLevel: IntensityLevel;
    keyLifts: string[];
    notes?: string;
  }>;

  // Special weeks
  deloadWeeks: number[];
  testWeeks?: number[];
  taperWeeks?: number[];

  // Progression model
  progressionModel: {
    type: 'linear' | 'undulating' | 'block' | 'conjugate' | 'autoregulated';
    description: string;
    weeklyIncrement?: string; // "2.5kg" or "5%"
  };

  // Weekly structure
  weeklyStructure: {
    splitType: 'full_body' | 'upper_lower' | 'push_pull_legs' | 'bro_split' | 'custom';
    daysPerWeek: number;
    dayFocuses: Array<{
      dayNumber: number;
      dayName: string;
      focus: string[];
      muscleGroups: string[];
    }>;
  };

  // Risk management
  riskAreas: string[];
  autoregulationRules?: string[];
}

export interface PeriodizationOutput {
  macroPlan: MacroPlan;
  checkpoint: Checkpoint;
}

// ============================================================================
// 4. WEEK PLANNER & SESSION TYPES
// ============================================================================

export interface WeekPlannerInput {
  macroPlan: MacroPlan;
  profile: AthleteProfile;
  brief: AthleteBrief;
  weekNumber: number;
}

export interface SessionBlueprint {
  dayNumber: number;
  dayName: string;
  focus: string[];
  targetMuscles: string[];
  // Detailed instructions for the SessionDesigner
  primaryMovementPattern: string; // e.g., "Squat", "Hinge", "Vertical Push"
  sessionRole: string; // e.g., "Hypertrophy focus", "Strength expression"
  volumeTargets: {
    totalSets: number;
    description: string; // e.g., "5 compounds, 3 isolation"
  };
  intensityTargets: {
    mainLift: string; // e.g., "RPE 8-9"
    accessories: string; // e.g., "RPE 7-8"
  };
  durationMinutes: number;
}

export interface Week1Plan {
  weekNumber: 1;
  focus: string;
  phase: Phase;
  days: SessionBlueprint[];
  overview: string;
}

export interface WeekPlannerOutput {
  weekPlan: Week1Plan;
  checkpoint: Checkpoint;
}

export interface SessionDesignerInput {
  blueprint: SessionBlueprint;
  profile: AthleteProfile;
  brief: AthleteBrief;
  exerciseCatalog: Array<{
    id: string;
    name: string;
    category: string;
    targetMuscles: string[];
    equipment: string[];
  }>;
}

export interface SessionBuilderInput {
  // Legacy input support for backward compatibility if needed,
  // or refined for the new Designer agent
  macroPlan: MacroPlan;
  profile: AthleteProfile;
  brief: AthleteBrief;
  weekNumber: number;
  exerciseCatalog: Array<{
    id: string;
    name: string;
    category: string;
    targetMuscles: string[];
    equipment: string[];
  }>;
}

export interface WorkoutSession {
  dayNumber: number;
  dayName: string;
  name: string;
  focus: string[];
  targetMuscles: string[];

  warmup?: {
    duration: number;
    activities: string[];
  };

  exercises: Array<{
    exerciseId?: string;
    name: string;
    category: 'compound' | 'isolation' | 'cardio' | 'core' | 'mobility';
    sets: number;
    reps: string; // "5" or "8-12"
    rpe?: number;
    rir?: number;
    intensityPercent?: number;
    weight?: number;
    rest: number;
    tempo?: string;
    notes?: string;
    technicalCues?: string[];
  }>;

  cooldown?: {
    duration: number;
    activities: string[];
  };

  estimatedDuration: number;
  totalVolume: number;
  intensityRating: 'low' | 'moderate' | 'high' | 'very_high';
}

export interface Week1Template {
  weekNumber: 1;
  focus: string;
  phase: Phase;
  days: WorkoutSession[];
  totalVolume: number;
  averageIntensity: number;
}

export interface SessionBuilderOutput {
  week1: Week1Template;
  checkpoint: Checkpoint;
}

// ============================================================================
// 5. PROGRESSION DIFF TYPES
// ============================================================================

export interface ProgressionDiffInput {
  week1Template: Week1Template;
  macroPlan: MacroPlan;
  profile: AthleteProfile;
  durationWeeks: number;
}

export interface WeekDiff {
  focus: string;
  phase: Phase;
  notes?: string;
  changes: Array<{
    dayNumber: number;
    exerciseIndex: number;
    setGroupIndex?: number;
    // What to change
    reps?: number | string;
    weight?: number;
    intensityPercent?: number;
    rpe?: number;
    rest?: number;
    sets?: number;
    // Swap exercise
    swapExercise?: {
      from: string;
      to: string;
      reason: string;
    };
  }>;
}

export interface ProgressionDiffOutput {
  week2?: WeekDiff;
  week3?: WeekDiff;
  week4?: WeekDiff;
  week5?: WeekDiff;
  week6?: WeekDiff;
  week7?: WeekDiff;
  week8?: WeekDiff;
}

// ============================================================================
// 6. LOAD CONTROLLER TYPES
// ============================================================================

export interface LoadControllerInput {
  program: {
    weeks: Array<{
      weekNumber: number;
      days: WorkoutSession[];
    }>;
  };
  profile: AthleteProfile;
  brief: AthleteBrief;
  weeklyMetrics?: {
    performanceTrend: 'improving' | 'stable' | 'declining';
    fatigueLevel: 'low' | 'moderate' | 'high';
    readinessScore?: number;
  };
}

export interface LoadAnalysis {
  // Volume analysis
  weeklyVolume: Record<string, number>; // Volume per muscle group
  volumeProgression: number[]; // Per week

  // Load metrics
  monotony: number; // 0-1, lower is more varied
  strain: number; // Accumulated fatigue
  acuteChronicRatio: number; // ACWR

  // Risk assessment
  riskLevel: 'low' | 'moderate' | 'high';
  riskFactors: string[];

  // Suggested adjustments
  adjustments: Array<{
    type: 'reduce_volume' | 'add_deload' | 'increase_rest' | 'swap_exercise' | 'reduce_intensity';
    target: string; // Week/day or muscle group
    reason: string;
    priority: 'low' | 'medium' | 'high';
    suggestedChange?: {
      weekNumber: number;
      dayNumber?: number;
      exerciseIndex?: number;
      change: Record<string, any>;
    };
  }>;

  // Autoregulation rules
  autoregulationRules: Array<{
    condition: string;
    action: string;
    example: string;
  }>;
}

export interface LoadControllerOutput {
  analysis: LoadAnalysis;
  checkpoint: Checkpoint;
}

// ============================================================================
// 7. QA COACH TYPES
// ============================================================================

export interface QACoachInput {
  program: {
    weeks: Array<{
      weekNumber: number;
      days: WorkoutSession[];
    }>;
  };
  brief: AthleteBrief;
  profile: AthleteProfile;
  macroPlan: MacroPlan;
}

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';
export type IssueCategory =
  | 'coherence'
  | 'specificity'
  | 'sustainability'
  | 'redundancy'
  | 'gap'
  | 'progression';

export interface QAIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  location: string; // "Week 3, Day 2" or "Global"
  suggestedFix?: {
    weekNumber?: number;
    dayNumber?: number;
    exerciseIndex?: number;
    change: Record<string, any>;
    explanation: string;
  };
}

export interface QAReport {
  // Overall assessment
  overallScore: number; // 0-100
  passesQA: boolean;
  coachLikeness: number; // 0-10, how "professional" it looks

  // Issues found
  issues: QAIssue[];

  // Positive aspects
  strengths: string[];

  // Summary
  summary: string;
  recommendations: string[];
}

export interface QACoachOutput {
  report: QAReport;
  checkpoint: Checkpoint;
}

// ============================================================================
// 8. EVALUATION RUBRIC TYPES (Self-scoring)
// ============================================================================

export interface EvaluationRubric {
  specificity: number; // 0-10: How specific to the goal?
  progressivity: number; // 0-10: Clear progression?
  sustainability: number; // 0-10: Sustainable for N weeks?
  varietyBalance: number; // 0-10: Right amount of variety?
  recoveryManagement: number; // 0-10: Adequate recovery?
  coachLikeness: number; // 0-10: Looks professionally written?
  overall: number; // Weighted average
  breakdown: Record<string, string>; // Explanations
}

// ============================================================================
// 9. COACH PERSONA TYPES
// ============================================================================

export type CoachPersona =
  | 'evidence_based' // Helms, Nuckols - RPE, autoregulation
  | 'high_volume' // Israetel - MEV/MAV/MRV
  | 'conjugate' // Westside - max effort, dynamic effort
  | 'minimalist' // Wendler 5/3/1 style
  | 'bodybuilding' // Bro split, high volume isolation
  | 'powerlifting' // Peaking, heavy singles
  | 'athletic'; // Sport-specific, power development

export interface PersonaConfig {
  name: CoachPersona;
  description: string;

  // Defaults
  preferredSplit: string;
  preferredRepRanges: Record<string, string>; // By goal
  preferredRPE: [number, number]; // Range
  volumeApproach: 'high' | 'moderate' | 'low';
  intensityApproach: 'high' | 'moderate' | 'undulating';
  restPeriods: Record<string, number>; // By exercise type
  deloadFrequency: number; // Every N weeks
  autoregulation: boolean;

  // Style
  cueStyle: 'technical' | 'simple' | 'motivational';
  notesStyle: 'detailed' | 'minimal';
}

// ============================================================================
// 10. EXERCISE KNOWLEDGE GRAPH TYPES
// ============================================================================

export interface ExerciseNode {
  id: string;
  name: string;

  // Categorization
  category: 'compound' | 'isolation' | 'cardio' | 'core' | 'mobility';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];

  // Relationships
  relations: {
    substitutes: string[]; // Direct alternatives
    progressions: string[]; // Harder variants
    regressions: string[]; // Easier variants
    synergists: string[]; // Often paired
    antagonists: string[]; // For supersets
    variations: string[]; // Same movement, different setup
  };

  // Properties
  properties: {
    fatigueRatio: number; // Fatigue per unit stimulus (1-5)
    technicalDemand: 'low' | 'medium' | 'high';
    loadingPotential: 'low' | 'medium' | 'high';
    stabilityRequirement: 'low' | 'medium' | 'high';
    rangeOfMotion: 'short' | 'medium' | 'full';
  };
}

// ============================================================================
// 11. FEEDBACK LEARNING TYPES
// ============================================================================

export interface ProgramFeedback {
  id?: string;
  programId: string;
  athleteId: string;
  submittedAt: Date;
  status?: 'draft' | 'submitted' | 'archived';

  // Ratings
  overallRating: 1 | 2 | 3 | 4 | 5;
  volumeRating: 'too_low' | 'right' | 'too_high';
  intensityRating: 'too_low' | 'right' | 'too_high';
  difficultyRating: 'too_easy' | 'right' | 'too_hard';

  // Exercise-specific feedback
  exerciseFeedback: Array<{
    exerciseName: string;
    issue?: 'too_hard' | 'pain' | 'boring' | 'ineffective' | 'loved_it';
    notes?: string;
  }>;

  // Results (if tracked)
  results?: {
    strengthGains: number; // % improvement
    hypertrophyGains?: number; // Subjective or measured
    adherence: number; // % sessions completed
    enjoyment: number; // 1-10
  };

  // Free text
  whatWorked?: string;
  whatDidntWork?: string;
  suggestions?: string;
}

// ============================================================================
// 12. CONTEXT SUMMARY TYPES
// ============================================================================

export interface Week1Summary {
  daysCount: number;
  exercisesPerDay: number[];
  totalExercises: number;
  exerciseList: string[];
  volumeByMuscle: Record<string, number>;
  intensityRange: [number, number];
  avgRestSeconds: number;
  totalVolume: number;
}

export interface ProgramSummary {
  name: string;
  durationWeeks: number;
  daysPerWeek: number;
  totalSessions: number;
  goal: Goal;
  level: ExperienceLevel;
  phases: string[];
  keyLifts: string[];
  deloadWeeks: number[];
}

export interface AgentContext {
  brief?: AthleteBrief;
  profile?: AthleteProfile;
  macroPlan?: MacroPlan;
  week1Template?: Week1Template;
  week1Summary?: Week1Summary;
  progressionDiff?: ProgressionDiffOutput;
  loadAnalysis?: LoadAnalysis;
  qaReport?: QAReport;

  // Extended Context
  existingProfile?: ExistingUserProfile | null;
  bodyHistory?: BodyMeasurementHistory | null;
  workoutHistory?: WorkoutHistory | null;
  exerciseCatalog?: ExerciseCatalogItem[];
  userMaxes?: UserMaxes | null;
  lastProgram?: LastProgramContext | null;
  nutritionContext?: NutritionContext | null;
  memoryContext?: UserMemoryContext | null;
}

export interface AgentResultMetrics {
  totalDurationMs: number;
  tokensUsed: number;
  agentDurations: Record<string, number>;
}

export interface PlannedGoal {
  id: string;
  title: string;
  description: string;
  timeHorizon: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  targetDate?: string;
  milestones?: any[];
  successMetrics?: string[];
}

export interface PlannedTask {
  id: string;
  title: string;
  description?: string;
  goalId: string;
  estimatedMinutes: number;
  complexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'VERY_COMPLEX';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dependencies?: string[];
  tags: string[];
  suggestedDeadline?: string;
}

// ============================================================================
// EXTENDED CONTEXT TYPES (History-Aware Intelligence)
// ============================================================================

/**
 * Existing user profile from database.
 */
export interface ExistingUserProfile {
  id: string;
  userId: string;
  age: number | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER' | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE' | null;
  trainingFrequency: number | null;
  dailyCalories: number | null;
  workoutGoal: string | null;
  workoutGoals: string[];
  equipment: string[];
  dietaryRestrictions: string[];
  dietType: string | null;
  healthNotes: string | null;
}

/**
 * Body measurement history.
 */
export interface BodyMeasurementHistory {
  measurements: Array<{
    date: Date;
    weight: number | null;
    bodyFat: number | null;
    muscleMass: number | null;
  }>;
}

/**
 * Previous workout programs.
 */
export interface WorkoutHistory {
  programs: Array<{
    id: string;
    name: string;
    goal: string;
    durationWeeks: number;
    completedWeeks?: number;
    createdAt: Date;
  }>;
}

export interface ExerciseCatalogItem {
  id: string;
  name: string;
  category: string;
  targetMuscles: string[];
  equipment: string[];
}

export interface UserMaxes {
  maxes: Array<{
    exerciseId: string;
    exerciseName: string;
    value: number;
    unit: 'kg' | 'lbs';
    confidence: 'tested' | 'estimated';
    lastUpdated: Date;
  }>;
}

export interface LastProgramContext {
  id: string;
  name: string;
  goal: string;
  durationWeeks: number;
  completedAt: Date;
  lastPhase: 'accumulation' | 'intensification' | 'realization' | 'deload' | 'unknown';
  daysSinceCompletion: number;
}

export interface NutritionContext {
  hasActivePlan: boolean;
  nutritionGoal: string;
  calorieBalance: number; // positive = surplus, negative = deficit
  proteinPerKg: number | null;
  implication: 'surplus' | 'deficit' | 'maintenance';
}

export interface UserMemoryContext {
  preferences: Record<string, any>;
  injuries: string[];
  notes?: string;
  fitnessLevel?: ExperienceLevel;
  recentEvents?: Record<string, any>[];
}

export type WorkoutMeshContext = AgentContext;

// ============================================================================
// 13. ORCHESTRATOR TYPES
// ============================================================================

export interface OrchestrationResult {
  success: boolean;
  program?: WorkoutProgram;
  context: AgentContext;
  checkpoints: Checkpoint[];
  goals?: PlannedGoal[];
  tasks?: PlannedTask[];
  errors?: string[];
  metrics: {
    totalDurationMs: number;
    tokensUsed: number;
    agentDurations: Record<string, number>;
  };
}
