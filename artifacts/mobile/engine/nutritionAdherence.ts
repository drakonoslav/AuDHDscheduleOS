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

// ─── Ingredient unit display ──────────────────────────────────────────────────
const INGREDIENT_UNIT: Record<string, string> = {
  BANANA: "whole",
  YOGURT: "cup",
  EGG:    "egg",
};
function ingredientUnit(id: string): string { return INGREDIENT_UNIT[id] ?? "g"; }

const INGREDIENT_NAME: Record<string, string> = {
  OAT:     "Oats",
  WHEY:    "Whey",
  DEXTRIN: "Dextrin",
  YOGURT:  "Yogurt",
  BANANA:  "Banana",
  EGG:     "Egg",
  FLAX:    "Flax",
};
export function ingredientDisplayName(id: string): string { return INGREDIENT_NAME[id] ?? id; }

// Canonical display order for ingredients
const INGREDIENT_ORDER: Record<string, number> = {
  BANANA: 0, OAT: 1, WHEY: 2, DEXTRIN: 3, YOGURT: 4, FLAX: 5, EGG: 6,
};

// ─── Per-ingredient tally ─────────────────────────────────────────────────────
export interface IngredientTally {
  ingredientId: string;
  actual:  number;   // amount consumed (done=1.0, partial=0.5 of amountUnit)
  planned: number;   // amount planned for the day (all non-skipped blocks)
  unit:    string;   // "g", "whole", "cup", "egg"
}

// ─── Public types ──────────────────────────────────────────────────────────────
export interface NutritionAdherenceResult {
  mealAdherence:    number;   // 0.0 – 1.0
  caloricAdherence: number;   // 0.0 – 1.0
  proteinAdherence: number;   // 0.0 – 1.0
  timingScore:      number;   // 0.0 – 1.0  (critical slots hit)
  overallScore:     number;   // 0 – 100

  actualKcal:    number;   // kcal actually consumed (done + partial blocks)
  targetKcal:    number;   // phase daily kcal target
  actualProtein: number;   // protein actually consumed
  targetProtein: number;   // phase daily protein target
  plannedKcal:   number;   // kcal the full day's non-skipped plan delivers
  plannedProtein:number;   // protein the full day's non-skipped plan delivers

  completedMeals:    number;   // count of done + partial blocks
  totalMeals:        number;   // all meal-type blocks for the day
  criticalScheduled: number;   // how many critical slots were in today's schedule
  criticalMissed:    MealSlot[];
  ingredientTotals:  IngredientTally[];  // per-ingredient actual vs planned
}

// ─── Core computation ─────────────────────────────────────────────────────────
export function computeNutritionAdherence(
  blocks: ScheduleBlock[],
  nutritionPhaseId: NutritionPhaseId,
): NutritionAdherenceResult {
  const templates = getMealTemplatesForPhase(nutritionPhaseId);
  const targets   = PHASE_DAILY_TARGETS[nutritionPhaseId];

  // Template-level daily sums — used only for proportional weighting so that
  // each meal's share of the phase target stays consistent with its relative
  // macro composition.  The authoritative total comes from PHASE_DAILY_TARGETS.
  const tmplDailyKcal    = templates.reduce((s, t) => s + t.totalKcal,    0) || 1;
  const tmplDailyProtein = templates.reduce((s, t) => s + t.totalProtein, 0) || 1;

  const mealBlocks = blocks.filter((b) => b.blockType === "meal");

  let actualKcal    = 0;
  let actualProtein = 0;
  let plannedKcal   = 0;
  let plannedProtein= 0;
  let completionSum = 0;
  let criticalHit   = 0;
  const criticalMissed: MealSlot[] = [];
  // ingredientId → { actual, planned }
  const ingMap = new Map<string, { actual: number; planned: number }>();

  for (const block of mealBlocks) {
    const slot     = labelToSlot(block.label);
    if (!slot) continue;

    const template = templates.find((t) => t.mealSlot === slot);
    if (!template) continue;

    // Scale each meal's contribution so that 7/7 done always equals the phase
    // daily target (PHASE_DAILY_TARGETS), matching what the Meals tab shows.
    const kcalWeight    = template.totalKcal    / tmplDailyKcal;
    const proteinWeight = template.totalProtein / tmplDailyProtein;
    const scaledKcal    = targets.kcal    * kcalWeight;
    const scaledProtein = targets.protein * proteinWeight;

    const factor      = completionFactor(block.status);
    actualKcal       += scaledKcal    * factor;
    actualProtein    += scaledProtein * factor;
    completionSum    += factor;

    if (block.status !== "skipped") {
      plannedKcal    += scaledKcal;
      plannedProtein += scaledProtein;
    }

    // Accumulate per-ingredient amounts from the compiled template lines
    for (const line of template.lines) {
      const entry = ingMap.get(line.ingredientId) ?? { actual: 0, planned: 0 };
      entry.actual  += line.amountUnit * factor;
      if (block.status !== "skipped") {
        entry.planned += line.amountUnit;
      }
      ingMap.set(line.ingredientId, entry);
    }

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

  // Build sorted ingredient tally
  const ingredientTotals: IngredientTally[] = Array.from(ingMap.entries())
    .map(([ingredientId, { actual, planned }]) => ({
      ingredientId,
      actual:  Math.round(actual  * 10) / 10,
      planned: Math.round(planned * 10) / 10,
      unit:    ingredientUnit(ingredientId),
    }))
    .sort((a, b) =>
      (INGREDIENT_ORDER[a.ingredientId] ?? 99) - (INGREDIENT_ORDER[b.ingredientId] ?? 99),
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
    plannedKcal:       Math.round(plannedKcal),
    plannedProtein:    Math.round(plannedProtein * 10) / 10,
    completedMeals,
    totalMeals,
    criticalScheduled: scheduledCritical,
    criticalMissed,
    ingredientTotals,
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
