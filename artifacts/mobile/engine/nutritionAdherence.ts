import type { ScheduleBlock, NutritionPhaseId, MealSlot } from "@/types";
import { getMealTemplatesForPhase, PHASE_DAILY_TARGETS } from "@/data/mealTemplates";

// ─── Label → MealSlot normalisation ───────────────────────────────────────────
// Strips spaces and hyphens, lowercases, maps to canonical MealSlot key.
// Handles both "Pre Cardio" (seed template) and "Pre-Cardio" (slot def) etc.
function labelToSlot(label: string): MealSlot | null {
  const n = label.toLowerCase().replace(/[\s\-]/g, "");
  const map: Record<string, MealSlot> = {
    precardio:     "precardio",
    postcardio:    "postcardio",
    midmorning:    "midmorning",
    prelift:       "prelift",
    postlift:      "postlift",
    evening:       "evening",
    proteinreserve:"proteinreserve",
  };
  return map[n] ?? null;
}

// done=1.0, partial=0.5, everything else=0.0
function completionFactor(status: string): number {
  if (status === "done") return 1.0;
  if (status === "partial") return 0.5;
  return 0.0;
}

// Critical = timing-sensitive; missing these has the biggest physiological cost
const CRITICAL_SLOTS: MealSlot[] = ["precardio", "postcardio", "prelift", "postlift"];

// ─── Public types ──────────────────────────────────────────────────────────────
export interface NutritionAdherenceResult {
  mealAdherence:    number;   // 0.0 – 1.0
  caloricAdherence: number;   // 0.0 – 1.0
  proteinAdherence: number;   // 0.0 – 1.0
  timingScore:      number;   // 0.0 – 1.0  (critical slots hit)
  overallScore:     number;   // 0 – 100

  actualKcal:    number;
  targetKcal:    number;
  actualProtein: number;
  targetProtein: number;

  completedMeals:    number;   // count of done + partial blocks
  totalMeals:        number;   // all meal-type blocks for the day
  criticalScheduled: number;   // how many critical slots were in today's schedule
  criticalMissed:    MealSlot[];
}

// ─── Core computation ─────────────────────────────────────────────────────────
export function computeNutritionAdherence(
  blocks: ScheduleBlock[],
  nutritionPhaseId: NutritionPhaseId,
): NutritionAdherenceResult {
  const templates = getMealTemplatesForPhase(nutritionPhaseId);
  const targets   = PHASE_DAILY_TARGETS[nutritionPhaseId];

  const mealBlocks = blocks.filter((b) => b.blockType === "meal");

  let actualKcal    = 0;
  let actualProtein = 0;
  let completionSum = 0;     // sum of completion factors (0.0 – 1.0) across all meal blocks
  let criticalHit   = 0;
  const criticalMissed: MealSlot[] = [];

  for (const block of mealBlocks) {
    const slot     = labelToSlot(block.label);
    if (!slot) continue;

    const template = templates.find((t) => t.mealSlot === slot);
    if (!template) continue;

    const factor      = completionFactor(block.status);
    actualKcal       += template.totalKcal    * factor;
    actualProtein    += template.totalProtein * factor;
    completionSum    += factor;

    if (CRITICAL_SLOTS.includes(slot)) {
      if (factor > 0) {
        criticalHit++;
      } else {
        criticalMissed.push(slot);
      }
    }
  }

  const totalMeals     = mealBlocks.length;
  const completedMeals = mealBlocks.filter((b) => b.status === "done" || b.status === "partial").length;

  // All ratios capped at 1.0 to avoid showing > 100%
  const mealAdherence    = totalMeals > 0 ? Math.min(1, completionSum / totalMeals) : 0;
  const caloricAdherence = targets.kcal    > 0 ? Math.min(1, actualKcal    / targets.kcal)    : 0;
  const proteinAdherence = targets.protein > 0 ? Math.min(1, actualProtein / targets.protein) : 0;

  // Count only the critical slots that were actually scheduled today
  const scheduledCritical = mealBlocks.filter((b) => {
    const slot = labelToSlot(b.label);
    return slot && CRITICAL_SLOTS.includes(slot);
  }).length;
  const timingScore = scheduledCritical > 0 ? criticalHit / scheduledCritical : 0;

  // Composite: meal adherence 40%, calories 30%, protein 20%, timing 10%
  const overallScore = Math.round(
    (mealAdherence * 0.40 +
     caloricAdherence * 0.30 +
     proteinAdherence * 0.20 +
     timingScore * 0.10) * 100,
  );

  return {
    mealAdherence,
    caloricAdherence,
    proteinAdherence,
    timingScore,
    overallScore,
    actualKcal:        Math.round(actualKcal),
    targetKcal:        targets.kcal,
    actualProtein:     Math.round(actualProtein * 10) / 10,
    targetProtein:     targets.protein,
    completedMeals,
    totalMeals,
    criticalScheduled: scheduledCritical,
    criticalMissed,
  };
}

// ─── Slot label helpers (for display) ────────────────────────────────────────
const SLOT_DISPLAY: Record<MealSlot, string> = {
  precardio:     "Pre Cardio",
  postcardio:    "Post Cardio",
  midmorning:    "Mid Morning",
  prelift:       "Pre Lift",
  postlift:      "Post Lift",
  evening:       "Evening",
  proteinreserve:"Reserve",
};

export function slotDisplayName(slot: MealSlot): string {
  return SLOT_DISPLAY[slot] ?? slot;
}
