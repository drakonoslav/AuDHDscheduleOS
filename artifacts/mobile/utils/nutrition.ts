/**
 * nutrition.ts — Canonical utility functions for the three-layer data model.
 *
 * Architectural rules enforced here:
 *   1. SchedulePhaseTag  ≠  NutritionPhaseId  ≠  OrbitalPhaseId
 *   2. Nutrition → Orbital translation always goes through NUTRITION_TO_ORBITAL_MAP.
 *      It is NEVER inferred or guessed elsewhere.
 *   3. meal_template_id always parses into (nutritionPhaseId + mealSlot).
 *      It is never treated as either field on its own.
 */

import type {
  MealSlot,
  MealTemplateCompiled,
  NutritionPhaseId,
  NutritionToOrbitalMap,
  OrbitalPhaseId,
} from "@/types";

import { MEAL_SLOT_DEFS } from "@/data/mealSlotDefs";
import { MEAL_TEMPLATE_LINES, MEAL_TEMPLATES_COMPILED, PHASE_DAILY_TARGETS } from "@/data/mealTemplates";
import { NUTRITION_TO_ORBITAL_MAP } from "@/data/nutritionToOrbitalMap";

// ─────────────────────────────────────────────────────────────────────────────
// Return types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedMealTemplateId {
  nutritionPhaseId: NutritionPhaseId;
  mealSlot: MealSlot;
}

export interface OrbitalPhaseResult {
  orbitalPhasePrimary: OrbitalPhaseId;
  orbitalPhaseSecondary: OrbitalPhaseId;
  notes: string;
}

export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. parseMealTemplateId(meal_template_id)
//    Splits a composite meal_template_id into its two component fields.
//
//    Format: "{nutritionPhaseId}_{mealSlot}"
//    Example: "base_precardio"  →  { nutritionPhaseId: "base", mealSlot: "precardio" }
//
//    Returns null if the string cannot be parsed.
// ─────────────────────────────────────────────────────────────────────────────
const VALID_NUTRITION_PHASES = new Set<string>([
  "base", "carbup", "carbcut", "fatcut",
  "recomp", "deload", "dietbreak", "peakbulk",
]);

const VALID_MEAL_SLOTS = new Set<string>([
  "precardio", "postcardio", "midmorning",
  "prelift", "postlift", "evening", "proteinreserve",
]);

export function parseMealTemplateId(
  mealTemplateId: string
): ParsedMealTemplateId | null {
  if (!mealTemplateId || typeof mealTemplateId !== "string") return null;

  // Try each known meal slot as a suffix (slot names never contain "_")
  for (const slot of VALID_MEAL_SLOTS) {
    const suffix = `_${slot}`;
    if (mealTemplateId.endsWith(suffix)) {
      const phaseId = mealTemplateId.slice(0, -suffix.length);
      if (VALID_NUTRITION_PHASES.has(phaseId)) {
        return {
          nutritionPhaseId: phaseId as NutritionPhaseId,
          mealSlot: slot as MealSlot,
        };
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. getOrbitalPhaseForNutritionPhase(nutrition_phase_id)
//    Translates a nutrition regime ID into its orbital physiology interpretation.
//    Always uses the translator table — never infers from nutrition data directly.
//
//    Returns null if the nutrition_phase_id is not in the table.
// ─────────────────────────────────────────────────────────────────────────────
export function getOrbitalPhaseForNutritionPhase(
  nutritionPhaseId: NutritionPhaseId
): OrbitalPhaseResult | null {
  const row: NutritionToOrbitalMap | undefined = NUTRITION_TO_ORBITAL_MAP.find(
    (m) => m.nutritionPhaseId === nutritionPhaseId
  );
  if (!row) return null;

  return {
    orbitalPhasePrimary: row.orbitalPhasePrimary,
    orbitalPhaseSecondary: row.orbitalPhaseSecondary,
    notes: row.notes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. summarizeMealTemplate(meal_template_id)
//    Returns the summed macro totals for a single meal slot within a nutrition phase.
//    Computed from the raw line-level ingredient data.
//
//    Returns null if the template_id cannot be parsed or is not found in data.
// ─────────────────────────────────────────────────────────────────────────────
export function summarizeMealTemplate(
  mealTemplateId: string
): MacroTotals | null {
  const parsed = parseMealTemplateId(mealTemplateId);
  if (!parsed) return null;

  // Sum the line-level data for this exact template_id
  const lines = MEAL_TEMPLATE_LINES.filter(
    (l) => l.mealTemplateId === mealTemplateId
  );
  if (lines.length === 0) return null;

  return {
    kcal:    roundMacro(lines.reduce((s, l) => s + l.kcalLine,    0)),
    protein: roundMacro(lines.reduce((s, l) => s + l.proteinLine, 0)),
    carbs:   roundMacro(lines.reduce((s, l) => s + l.carbsLine,   0)),
    fat:     roundMacro(lines.reduce((s, l) => s + l.fatLine,     0)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. summarizeNutritionPhaseDay(nutrition_phase_id)
//    Returns the summed macro totals across all meal slots for a given nutrition
//    phase — the full-day picture.
//    Also returns a breakdown per slot so callers can render a detail view.
//
//    Returns null if no templates are found for the phase.
// ─────────────────────────────────────────────────────────────────────────────
export interface DaySummary {
  nutritionPhaseId: NutritionPhaseId;
  totals: MacroTotals;
  /** Sorted by slot order */
  bySlot: Array<{
    mealSlot: MealSlot;
    slotLabel: string;
    slotOrder: number;
    totals: MacroTotals;
    templateId: string;
  }>;
  /** Reference target from spreadsheet (if available) */
  referenceTarget: MacroTotals | null;
}

export function summarizeNutritionPhaseDay(
  nutritionPhaseId: NutritionPhaseId
): DaySummary | null {
  const templates: MealTemplateCompiled[] = MEAL_TEMPLATES_COMPILED.filter(
    (t) => t.nutritionPhaseId === nutritionPhaseId
  );
  if (templates.length === 0) return null;

  const slotDefs = Object.fromEntries(MEAL_SLOT_DEFS.map((s) => [s.mealSlot, s]));

  const bySlot = templates
    .sort((a, b) => a.slotOrder - b.slotOrder)
    .map((t) => ({
      mealSlot: t.mealSlot,
      slotLabel: slotDefs[t.mealSlot]?.label ?? t.mealSlot,
      slotOrder: t.slotOrder,
      totals: {
        kcal:    roundMacro(t.totalKcal),
        protein: roundMacro(t.totalProtein),
        carbs:   roundMacro(t.totalCarbs),
        fat:     roundMacro(t.totalFat),
      },
      templateId: t.templateId,
    }));

  const totals: MacroTotals = {
    kcal:    roundMacro(bySlot.reduce((s, t) => s + t.totals.kcal,    0)),
    protein: roundMacro(bySlot.reduce((s, t) => s + t.totals.protein, 0)),
    carbs:   roundMacro(bySlot.reduce((s, t) => s + t.totals.carbs,   0)),
    fat:     roundMacro(bySlot.reduce((s, t) => s + t.totals.fat,     0)),
  };

  const ref = PHASE_DAILY_TARGETS[nutritionPhaseId] ?? null;

  return {
    nutritionPhaseId,
    totals,
    bySlot,
    referenceTarget: ref
      ? { kcal: ref.kcal, protein: ref.protein, carbs: ref.carbs, fat: ref.fat }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Round to 1 decimal place for macro display consistency */
function roundMacro(n: number): number {
  return Math.round(n * 10) / 10;
}
