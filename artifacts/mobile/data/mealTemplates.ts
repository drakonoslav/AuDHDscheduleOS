import type { MealTemplateLine, MealTemplateCompiled, NutritionPhaseId, MealSlot } from "@/types";
import { NUTRITION_TO_ORBITAL } from "./nutritionToOrbitalMap";
import { MEAL_SLOT_DEFS } from "./mealSlotDefs";

// Raw template lines — meal_template_id parses to nutritionPhaseId + mealSlot
// Amounts sourced from the base macro spreadsheet
const RAW_LINES: MealTemplateLine[] = [
  // BASE ─────────────────────────────────────────────────────────
  { mealTemplateId: "base_precardio",      nutritionPhaseId: "base", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8, proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },
  { mealTemplateId: "base_postcardio",     nutritionPhaseId: "base", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 120, prepNote: "g",          kcalLine: 480.0, proteinLine: 15.96, carbsLine: 72.0,  fatLine: 6.0 },
  { mealTemplateId: "base_postcardio",     nutritionPhaseId: "base", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 25,  prepNote: "g",          kcalLine: 94.0,  proteinLine: 21.95, carbsLine: 0.78,  fatLine: 0.0 },
  { mealTemplateId: "base_postcardio",     nutritionPhaseId: "base", mealSlot: "postcardio",     lineNo: 3, ingredientId: "MCT",     amountUnit: 10,  prepNote: "g",          kcalLine: 71.0,  proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 8.0 },
  { mealTemplateId: "base_midmorning",     nutritionPhaseId: "base", mealSlot: "midmorning",     lineNo: 1, ingredientId: "FLAX",    amountUnit: 30,  prepNote: "g",          kcalLine: 97.2,  proteinLine: 9.9,   carbsLine: 2.31,  fatLine: 3.0 },
  { mealTemplateId: "base_midmorning",     nutritionPhaseId: "base", mealSlot: "midmorning",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 15,  prepNote: "g",          kcalLine: 56.4,  proteinLine: 13.17, carbsLine: 0.47,  fatLine: 0.0 },
  { mealTemplateId: "base_midmorning",     nutritionPhaseId: "base", mealSlot: "midmorning",     lineNo: 3, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5, proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "base_prelift",        nutritionPhaseId: "base", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 80,  prepNote: "g",          kcalLine: 309.6, proteinLine: 0.0,   carbsLine: 77.84, fatLine: 0.0 },
  { mealTemplateId: "base_prelift",        nutritionPhaseId: "base", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,  prepNote: "g",          kcalLine: 75.2,  proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0 },
  { mealTemplateId: "base_postlift",       nutritionPhaseId: "base", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 40,  prepNote: "g",          kcalLine: 154.8, proteinLine: 0.0,   carbsLine: 38.92, fatLine: 0.0 },
  { mealTemplateId: "base_postlift",       nutritionPhaseId: "base", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 30,  prepNote: "g",          kcalLine: 112.8, proteinLine: 26.34, carbsLine: 0.93,  fatLine: 0.0 },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 1, ingredientId: "EGG",     amountUnit: 2,   prepNote: "whole eggs", kcalLine: 155.0, proteinLine: 12.58, carbsLine: 1.12,  fatLine: 10.6 },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 30,  prepNote: "g",          kcalLine: 97.2,  proteinLine: 9.9,   carbsLine: 2.31,  fatLine: 3.0 },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 3, ingredientId: "MCT",     amountUnit: 20,  prepNote: "g",          kcalLine: 142.0, proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 16.0 },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 4, ingredientId: "OAT",     amountUnit: 124, prepNote: "g",          kcalLine: 496.0, proteinLine: 16.49, carbsLine: 74.4,  fatLine: 6.2 },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 5, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8, proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },
  { mealTemplateId: "base_proteinreserve", nutritionPhaseId: "base", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 0,   prepNote: "g",          kcalLine: 0.0,   proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 0.0 },

  // CARBUP ────────────────────────────────────────────────────────
  { mealTemplateId: "carbup_precardio",      nutritionPhaseId: "carbup", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1.37,  prepNote: "whole",      kcalLine: 142.2,  proteinLine: 1.19,  carbsLine: 34.4,  fatLine: 0.47 },
  { mealTemplateId: "carbup_postcardio",     nutritionPhaseId: "carbup", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 113.3, prepNote: "g",          kcalLine: 453.2,  proteinLine: 15.07, carbsLine: 67.98, fatLine: 5.67 },
  { mealTemplateId: "carbup_postcardio",     nutritionPhaseId: "carbup", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 25,    prepNote: "g",          kcalLine: 94.0,   proteinLine: 21.95, carbsLine: 0.78,  fatLine: 0.0 },
  { mealTemplateId: "carbup_postcardio",     nutritionPhaseId: "carbup", mealSlot: "postcardio",     lineNo: 3, ingredientId: "MCT",     amountUnit: 11.8,  prepNote: "g",          kcalLine: 83.8,   proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 9.44 },
  { mealTemplateId: "carbup_midmorning",     nutritionPhaseId: "carbup", mealSlot: "midmorning",     lineNo: 1, ingredientId: "FLAX",    amountUnit: 35.2,  prepNote: "g",          kcalLine: 114.1,  proteinLine: 11.62, carbsLine: 2.71,  fatLine: 3.52 },
  { mealTemplateId: "carbup_midmorning",     nutritionPhaseId: "carbup", mealSlot: "midmorning",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 15,    prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.47,  fatLine: 0.0 },
  { mealTemplateId: "carbup_midmorning",     nutritionPhaseId: "carbup", mealSlot: "midmorning",     lineNo: 3, ingredientId: "YOGURT",  amountUnit: 1.07,  prepNote: "cup",        kcalLine: 159.9,  proteinLine: 27.01, carbsLine: 9.53,  fatLine: 0.97 },
  { mealTemplateId: "carbup_prelift",        nutritionPhaseId: "carbup", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 142.2, prepNote: "g",          kcalLine: 550.3,  proteinLine: 0.0,   carbsLine: 138.3, fatLine: 0.0 },
  { mealTemplateId: "carbup_prelift",        nutritionPhaseId: "carbup", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,    prepNote: "g",          kcalLine: 75.2,   proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0 },
  { mealTemplateId: "carbup_postlift",       nutritionPhaseId: "carbup", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 71.1,  prepNote: "g",          kcalLine: 275.2,  proteinLine: 0.0,   carbsLine: 69.2,  fatLine: 0.0 },
  { mealTemplateId: "carbup_postlift",       nutritionPhaseId: "carbup", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 30,    prepNote: "g",          kcalLine: 112.8,  proteinLine: 26.34, carbsLine: 0.93,  fatLine: 0.0 },
  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 1, ingredientId: "EGG",     amountUnit: 2.2,   prepNote: "whole eggs", kcalLine: 170.5,  proteinLine: 13.84, carbsLine: 1.23,  fatLine: 11.66 },
  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 35.2,  prepNote: "g",          kcalLine: 114.1,  proteinLine: 11.62, carbsLine: 2.71,  fatLine: 3.52 },
  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 3, ingredientId: "MCT",     amountUnit: 23.5,  prepNote: "g",          kcalLine: 166.9,  proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 18.8 },
  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 4, ingredientId: "OAT",     amountUnit: 117,   prepNote: "g",          kcalLine: 468.0,  proteinLine: 15.56, carbsLine: 70.2,  fatLine: 5.85 },
  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 5, ingredientId: "BANANA",  amountUnit: 0.8,   prepNote: "whole",      kcalLine: 83.0,   proteinLine: 0.7,   carbsLine: 20.1,  fatLine: 0.27 },
  { mealTemplateId: "carbup_proteinreserve", nutritionPhaseId: "carbup", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 3.4,   prepNote: "g",          kcalLine: 12.8,   proteinLine: 2.99,  carbsLine: 0.11,  fatLine: 0.0 },

  // DELOAD ────────────────────────────────────────────────────────
  { mealTemplateId: "deload_precardio",      nutritionPhaseId: "deload", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 0.9,   prepNote: "whole",      kcalLine: 93.4,   proteinLine: 0.78,  carbsLine: 22.6,  fatLine: 0.31 },
  { mealTemplateId: "deload_postcardio",     nutritionPhaseId: "deload", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 111.9, prepNote: "g",          kcalLine: 447.6,  proteinLine: 14.88, carbsLine: 67.14, fatLine: 5.6 },
  { mealTemplateId: "deload_postcardio",     nutritionPhaseId: "deload", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 25,    prepNote: "g",          kcalLine: 94.0,   proteinLine: 21.95, carbsLine: 0.78,  fatLine: 0.0 },
  { mealTemplateId: "deload_postcardio",     nutritionPhaseId: "deload", mealSlot: "postcardio",     lineNo: 3, ingredientId: "MCT",     amountUnit: 10.3,  prepNote: "g",          kcalLine: 73.1,   proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 8.24 },
  { mealTemplateId: "deload_midmorning",     nutritionPhaseId: "deload", mealSlot: "midmorning",     lineNo: 1, ingredientId: "FLAX",    amountUnit: 32.4,  prepNote: "g",          kcalLine: 104.9,  proteinLine: 10.69, carbsLine: 2.49,  fatLine: 3.24 },
  { mealTemplateId: "deload_midmorning",     nutritionPhaseId: "deload", mealSlot: "midmorning",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 15,    prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.47,  fatLine: 0.0 },
  { mealTemplateId: "deload_midmorning",     nutritionPhaseId: "deload", mealSlot: "midmorning",     lineNo: 3, ingredientId: "YOGURT",  amountUnit: 1,     prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "deload_prelift",        nutritionPhaseId: "deload", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 56.7,  prepNote: "g",          kcalLine: 219.5,  proteinLine: 0.0,   carbsLine: 55.17, fatLine: 0.0 },
  { mealTemplateId: "deload_prelift",        nutritionPhaseId: "deload", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,    prepNote: "g",          kcalLine: 75.2,   proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0 },
  { mealTemplateId: "deload_postlift",       nutritionPhaseId: "deload", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 28.4,  prepNote: "g",          kcalLine: 109.9,  proteinLine: 0.0,   carbsLine: 27.63, fatLine: 0.0 },
  { mealTemplateId: "deload_postlift",       nutritionPhaseId: "deload", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 30,    prepNote: "g",          kcalLine: 112.8,  proteinLine: 26.34, carbsLine: 0.93,  fatLine: 0.0 },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 1, ingredientId: "EGG",     amountUnit: 2.1,   prepNote: "whole eggs", kcalLine: 162.8,  proteinLine: 13.21, carbsLine: 1.18,  fatLine: 11.13 },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 32.4,  prepNote: "g",          kcalLine: 104.9,  proteinLine: 10.69, carbsLine: 2.49,  fatLine: 3.24 },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 3, ingredientId: "MCT",     amountUnit: 20.6,  prepNote: "g",          kcalLine: 146.3,  proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 16.48 },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 4, ingredientId: "OAT",     amountUnit: 115.6, prepNote: "g",          kcalLine: 462.4,  proteinLine: 15.37, carbsLine: 69.36, fatLine: 5.78 },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 5, ingredientId: "BANANA",  amountUnit: 0.9,   prepNote: "whole",      kcalLine: 93.4,   proteinLine: 0.78,  carbsLine: 22.6,  fatLine: 0.31 },
  { mealTemplateId: "deload_proteinreserve", nutritionPhaseId: "deload", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 1.8,   prepNote: "g",          kcalLine: 6.8,    proteinLine: 1.58,  carbsLine: 0.06,  fatLine: 0.0 },

  // RECOMP ────────────────────────────────────────────────────────
  { mealTemplateId: "recomp_precardio",      nutritionPhaseId: "recomp", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 0.8,   prepNote: "whole",      kcalLine: 83.0,   proteinLine: 0.70,  carbsLine: 20.1,  fatLine: 0.27 },
  { mealTemplateId: "recomp_postcardio",     nutritionPhaseId: "recomp", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 141.2, prepNote: "g",          kcalLine: 564.8,  proteinLine: 18.78, carbsLine: 84.72, fatLine: 7.06 },
  { mealTemplateId: "recomp_postcardio",     nutritionPhaseId: "recomp", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 24.9,  prepNote: "g",          kcalLine: 93.6,   proteinLine: 21.87, carbsLine: 0.77,  fatLine: 0.0 },
  { mealTemplateId: "recomp_postcardio",     nutritionPhaseId: "recomp", mealSlot: "postcardio",     lineNo: 3, ingredientId: "MCT",     amountUnit: 7.3,   prepNote: "g",          kcalLine: 51.8,   proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 5.84 },
  { mealTemplateId: "recomp_midmorning",     nutritionPhaseId: "recomp", mealSlot: "midmorning",     lineNo: 1, ingredientId: "FLAX",    amountUnit: 34.3,  prepNote: "g",          kcalLine: 111.1,  proteinLine: 11.32, carbsLine: 2.64,  fatLine: 3.43 },
  { mealTemplateId: "recomp_midmorning",     nutritionPhaseId: "recomp", mealSlot: "midmorning",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 15,    prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.47,  fatLine: 0.0 },
  { mealTemplateId: "recomp_midmorning",     nutritionPhaseId: "recomp", mealSlot: "midmorning",     lineNo: 3, ingredientId: "YOGURT",  amountUnit: 1,     prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "recomp_prelift",        nutritionPhaseId: "recomp", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 48.4,  prepNote: "g",          kcalLine: 187.3,  proteinLine: 0.0,   carbsLine: 47.1,  fatLine: 0.0 },
  { mealTemplateId: "recomp_prelift",        nutritionPhaseId: "recomp", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,    prepNote: "g",          kcalLine: 75.2,   proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0 },
  { mealTemplateId: "recomp_postlift",       nutritionPhaseId: "recomp", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 24.2,  prepNote: "g",          kcalLine: 93.7,   proteinLine: 0.0,   carbsLine: 23.55, fatLine: 0.0 },
  { mealTemplateId: "recomp_postlift",       nutritionPhaseId: "recomp", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 29.9,  prepNote: "g",          kcalLine: 112.4,  proteinLine: 26.25, carbsLine: 0.93,  fatLine: 0.0 },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 1, ingredientId: "EGG",     amountUnit: 1.9,   prepNote: "whole eggs", kcalLine: 147.3,  proteinLine: 11.95, carbsLine: 1.06,  fatLine: 10.07 },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 34.3,  prepNote: "g",          kcalLine: 111.1,  proteinLine: 11.32, carbsLine: 2.64,  fatLine: 3.43 },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 3, ingredientId: "MCT",     amountUnit: 14.5,  prepNote: "g",          kcalLine: 103.0,  proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 11.6 },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 4, ingredientId: "OAT",     amountUnit: 145.9, prepNote: "g",          kcalLine: 583.6,  proteinLine: 19.41, carbsLine: 87.54, fatLine: 7.3 },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 5, ingredientId: "BANANA",  amountUnit: 0.8,   prepNote: "whole",      kcalLine: 83.0,   proteinLine: 0.70,  carbsLine: 20.1,  fatLine: 0.27 },
  { mealTemplateId: "recomp_proteinreserve", nutritionPhaseId: "recomp", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 0,     prepNote: "g",          kcalLine: 0.0,    proteinLine: 0.0,   carbsLine: 0.0,   fatLine: 0.0 },
];

// Compile raw lines into aggregated MealTemplateCompiled objects
function compileTemplates(lines: MealTemplateLine[]): MealTemplateCompiled[] {
  const grouped = new Map<string, MealTemplateLine[]>();
  for (const line of lines) {
    const existing = grouped.get(line.mealTemplateId) ?? [];
    existing.push(line);
    grouped.set(line.mealTemplateId, existing);
  }

  const result: MealTemplateCompiled[] = [];
  for (const [templateId, templateLines] of grouped) {
    const first = templateLines[0];
    const slotDef = MEAL_SLOT_DEFS.find((s) => s.mealSlot === first.mealSlot);
    const orbitalMap = NUTRITION_TO_ORBITAL[first.nutritionPhaseId];
    result.push({
      templateId,
      nutritionPhaseId: first.nutritionPhaseId as NutritionPhaseId,
      mealSlot: first.mealSlot as MealSlot,
      label: slotDef?.label ?? first.mealSlot,
      slotOrder: slotDef?.slotOrder ?? 0,
      totalKcal: templateLines.reduce((s, l) => s + l.kcalLine, 0),
      totalProtein: templateLines.reduce((s, l) => s + l.proteinLine, 0),
      totalCarbs: templateLines.reduce((s, l) => s + l.carbsLine, 0),
      totalFat: templateLines.reduce((s, l) => s + l.fatLine, 0),
      orbitalPhasePrimary: orbitalMap?.orbitalPhasePrimary ?? "expression",
      orbitalPhaseSecondary: orbitalMap?.orbitalPhaseSecondary ?? "priming",
      lines: templateLines,
    });
  }
  return result.sort((a, b) => a.slotOrder - b.slotOrder);
}

export const MEAL_TEMPLATE_LINES = RAW_LINES;
export const MEAL_TEMPLATES_COMPILED = compileTemplates(RAW_LINES);

export function getMealTemplatesForPhase(nutritionPhaseId: NutritionPhaseId): MealTemplateCompiled[] {
  return MEAL_TEMPLATES_COMPILED.filter((t) => t.nutritionPhaseId === nutritionPhaseId);
}

export function getDailyTotalsForPhase(nutritionPhaseId: NutritionPhaseId) {
  const templates = getMealTemplatesForPhase(nutritionPhaseId);
  return {
    kcal: Math.round(templates.reduce((s, t) => s + t.totalKcal, 0)),
    protein: Math.round(templates.reduce((s, t) => s + t.totalProtein, 0)),
    carbs: Math.round(templates.reduce((s, t) => s + t.totalCarbs, 0)),
    fat: Math.round(templates.reduce((s, t) => s + t.totalFat, 0)),
  };
}

// Reference daily targets by phase (from spreadsheet)
export const PHASE_DAILY_TARGETS: Record<NutritionPhaseId, { kcal: number; protein: number; carbs: number; fat: number }> = {
  base:      { kcal: 2695, protein: 174, carbs: 331, fat: 54 },
  carbup:    { kcal: 2800, protein: 175, carbs: 400, fat: 40 },
  carbcut:   { kcal: 2450, protein: 180, carbs: 250, fat: 60 },
  fatcut:    { kcal: 2400, protein: 180, carbs: 320, fat: 35 },
  recomp:    { kcal: 2575, protein: 180, carbs: 300, fat: 50 },
  deload:    { kcal: 2500, protein: 175, carbs: 280, fat: 55 },
  dietbreak: { kcal: 2800, protein: 175, carbs: 360, fat: 55 },
  peakbulk:  { kcal: 3000, protein: 180, carbs: 420, fat: 55 },
};
