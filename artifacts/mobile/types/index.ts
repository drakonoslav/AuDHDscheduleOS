// ─── SCHEDULE LAYER ──────────────────────────────────────────────────────────
// Tags for daily schedule block phases - NOT the same as nutrition or orbital phases
export type SchedulePhaseTag = "expansion" | "structuring" | "recovery";

export type BlockType =
  | "wake"
  | "meal"
  | "work"
  | "commute"
  | "cardio"
  | "lift"
  | "hobby"
  | "hygiene"
  | "chores"
  | "errands"
  | "bedtime"
  | "rest"
  | "other";

export type BlockStatus = "planned" | "done" | "skipped" | "partial" | "moved";

export type DayMode =
  | "expansion_favoring"
  | "structuring_favoring"
  | "recovery_favoring"
  | "mixed";

// ─── NUTRITION LAYER ──────────────────────────────────────────────────────────
// Nutrition regime IDs - the current dietary protocol the user is running
export type NutritionPhaseId =
  | "base"
  | "carbup"
  | "carbcut"
  | "fatcut"
  | "recomp"
  | "deload"
  | "dietbreak"
  | "peakbulk";

// ─── ORBITAL PHYSIOLOGY LAYER ─────────────────────────────────────────────────
// Physiological interpretation layer - NOT the same as nutrition regime
export type OrbitalPhaseId =
  | "priming"
  | "loading"
  | "accumulation"
  | "saturation"
  | "partitioning"
  | "resensitization"
  | "rebound"
  | "expression";

// ─── MEAL SLOT LAYER ──────────────────────────────────────────────────────────
// Canonical meal slots - timing-based, not regime-based
export type MealSlot =
  | "precardio"
  | "postcardio"
  | "midmorning"
  | "prelift"
  | "postlift"
  | "evening"
  | "proteinreserve";

// ─── SCHEDULE BLOCK ───────────────────────────────────────────────────────────
export interface BlockRatings {
  ease: number;           // 1–5
  resistance: number;     // 1–5
  overload: number;       // 1–5
  focus: number;          // 1–5
  satisfaction: number;   // 1–5
  transitionDifficulty: number; // 1–5
  feltTooEarly: number;   // 1–5
  feltTooLate: number;    // 1–5
  feltTooLong: number;    // 1–5
  feltTooShort: number;   // 1–5
}

export interface SensoryNotes {
  noise: boolean;
  light: boolean;
  textureDiscomfort: boolean;
  crowding: boolean;
  pressureHelped: boolean;
  headphonesUsed: boolean;
  notes?: string;
}

export interface ScheduleBlock {
  id: string;
  date: string;                    // YYYY-MM-DD
  blockType: BlockType;
  label: string;
  phaseTag: SchedulePhaseTag;      // schedule layer only
  plannedStart: string;            // HH:MM
  plannedEnd: string;              // HH:MM
  actualStart?: string;            // HH:MM
  actualEnd?: string;              // HH:MM
  status: BlockStatus;
  mealTemplateId?: string;         // e.g. "base_precardio" → parses to nutritionPhaseId + mealSlot
  ratings?: Partial<BlockRatings>;
  sensoryNotes?: Partial<SensoryNotes>;
  notes?: string;
  // Derived fields (auto-calculated)
  startDevMin?: number;
  endDevMin?: number;
  durationDevMin?: number;
  adherenceScore?: number;
}

// ─── DAILY STATE SNAPSHOT ─────────────────────────────────────────────────────
export interface DailyStateSnapshot {
  date: string;                     // YYYY-MM-DD
  sleepHours: number;
  sleepQuality: number;             // 1–5
  sensoryLoadBaseline: number;      // 1–5
  socialLoad: number;               // 1–5
  motivation: number;               // 1–5
  mentalFog: number;                // 1–5
  physicalEnergy: number;           // 1–5
  emotionalStability: number;       // 1–5
  noveltyHunger: number;            // 1–5
  structureHunger: number;          // 1–5
  pressureSeek: number;             // 1–5
  noiseAversion: number;            // 1–5
  lightAversion: number;            // 1–5
  textureSensitivity: number;       // 1–5
  // Derived scores
  adhdPullScore?: number;
  autismPullScore?: number;
  recoveryNeedScore?: number;
  recommendedDayMode?: DayMode;
  // Which nutrition regime the user is running today
  nutritionPhaseId?: NutritionPhaseId;
}

// ─── NUTRITION DATA STRUCTURES ───────────────────────────────────────────────
export interface NutritionPhase {
  phaseId: NutritionPhaseId;
  phaseName: string;
  description: string;
}

export interface OrbitalPhase {
  orbitalPhaseId: OrbitalPhaseId;
  orbitalPhaseName: string;
  orbitalOrder: number;
  description: string;
}

export interface NutritionToOrbitalMap {
  nutritionPhaseId: NutritionPhaseId;
  orbitalPhasePrimary: OrbitalPhaseId;
  orbitalPhaseSecondary: OrbitalPhaseId;
  notes: string;
}

export interface MealSlotDef {
  mealSlot: MealSlot;
  slotOrder: number;
  label: string;
  description: string;
}

export interface MealTemplateLine {
  mealTemplateId: string;          // e.g. "base_precardio"
  nutritionPhaseId: NutritionPhaseId;
  mealSlot: MealSlot;
  lineNo: number;
  ingredientId: string;
  amountUnit: number;
  prepNote: string;
  kcalLine: number;
  proteinLine: number;
  carbsLine: number;
  fatLine: number;
}

export interface MealTemplateCompiled {
  templateId: string;
  nutritionPhaseId: NutritionPhaseId;
  mealSlot: MealSlot;
  label: string;
  slotOrder: number;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  orbitalPhasePrimary: OrbitalPhaseId;
  orbitalPhaseSecondary: OrbitalPhaseId;
  lines: MealTemplateLine[];
}

export interface Ingredient {
  ingredientId: string;
  ingredientName: string;
  unitType: string;
  kcalPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
}

// ─── TRAINING LOG ─────────────────────────────────────────────────────────────
export interface TrainingLog {
  id: string;
  date: string;
  type: "cardio" | "lift";
  plannedTime: string;
  actualTime?: string;
  duration?: number;               // minutes
  intensity?: "low" | "moderate" | "high";
  preLiftMealTiming?: number;      // minutes before
  postLiftMealTiming?: number;     // minutes after
  motivationBefore?: number;       // 1–5
  resistanceBefore?: number;       // 1–5
  satisfactionAfter?: number;      // 1–5
  laterFatigueCost?: number;       // 1–5
  bedtimeImpact?: number;          // 1–5
  effectOnFocus?: number;          // 1–5
  effectOnSensoryCalm?: number;    // 1–5
  notes?: string;
}

// ─── RECOMMENDATIONS ─────────────────────────────────────────────────────────
export type RecommendationType =
  | "timing_shift"
  | "fewer_blocks"
  | "meal_timing"
  | "training_placement"
  | "environment"
  | "nutrition_phase";

export type RecommendationConfidence =
  | "pattern_backed"
  | "emerging"
  | "speculative";

export interface WeeklyRecommendation {
  id: string;
  weekStart: string;
  type: RecommendationType;
  confidence: RecommendationConfidence;
  title: string;
  body: string;
  actionable: string;
  dismissed: boolean;
}

// ─── BLOCK TEMPLATE (RECURRING SCHEDULE) ──────────────────────────────────────
// A reusable canonical block definition that can be applied to any day
export interface BlockTemplate {
  id: string;
  label: string;
  blockType: BlockType;
  phaseTag: SchedulePhaseTag;
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  daysOfWeek: number[]; // 0=Sun, 1=Mon … 6=Sat
  notes?: string;
}

// ─── QUANTITATIVE DAILY LOG ────────────────────────────────────────────────────
// Objective / measurable health data — separate from the qualitative snapshot
export interface QuantitativeDailyLog {
  id: string;
  date: string;                     // YYYY-MM-DD
  // Sleep stages (in minutes)
  awakeMin?: number;
  remMin?: number;
  coreMin?: number;
  deepMin?: number;
  // Vitals
  hrv?: number;                     // whole number
  rhr?: number;                     // whole number (bpm)
  // Body composition
  weightLbs?: number;               // xxx.x
  bodyFatPct?: number;              // xx.x
  skeletalMusclePct?: number;       // xx.x
  fatFreeMassLbs?: number;          // xxx.x
  // Measurements
  waistIn?: number;                 // increments of 0.25
  // Hormone signal
  hormoneDurationMin?: number;      // converted from hh:mm
  hormoneQuantCount?: number;       // xx.x
  hormoneQualCount?: number;        // xx.x
}

// ─── APP STATE ────────────────────────────────────────────────────────────────
export interface AppState {
  blocks: ScheduleBlock[];
  snapshots: DailyStateSnapshot[];
  trainingLogs: TrainingLog[];
  quantitativeLogs: QuantitativeDailyLog[];
  recommendations: WeeklyRecommendation[];
  blockTemplates: BlockTemplate[];
  currentNutritionPhaseId: NutritionPhaseId;
  onboardingComplete: boolean;
}
