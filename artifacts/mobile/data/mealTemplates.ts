import type { MealTemplateLine, MealTemplateCompiled, NutritionPhaseId, MealSlot } from "@/types";
import { NUTRITION_TO_ORBITAL } from "./nutritionToOrbitalMap";
import { MEAL_SLOT_DEFS } from "./mealSlotDefs";

// Raw template lines — meal_template_id parses to nutritionPhaseId + mealSlot
// Ingredient macros per unit:
//   OAT     4.0 kcal/g   | 0.133p | 0.6c  | 0.05f
//   WHEY    3.76 kcal/g  | 0.878p | 0.031c| 0.0f
//   DEXTRIN 3.87 kcal/g  | 0.0p   | 0.973c| 0.0f
//   YOGURT  149.5 kcal   | 25.24p | 8.91c | 0.91f  (per cup)
//   BANANA  103.8 kcal   | 0.87p  | 25.12c| 0.34f  (per banana)
//   EGG     77.5 kcal    | 6.29p  | 0.56c | 5.3f   (per egg)
//   FLAX    3.24 kcal/g  | 0.33p  | 0.077c| 0.1f
// MCT oil is NOT part of this plan.
const RAW_LINES: MealTemplateLine[] = [

  // ─── BASE (2695 / 174p / 331c / 54f) ─────────────────────────────────────
  { mealTemplateId: "base_precardio",      nutritionPhaseId: "base", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "base_postcardio",     nutritionPhaseId: "base", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 85,  prepNote: "g",          kcalLine: 340.0,  proteinLine: 11.305,carbsLine: 51.0,  fatLine: 4.25 },
  { mealTemplateId: "base_postcardio",     nutritionPhaseId: "base", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 25,  prepNote: "g",          kcalLine: 94.0,   proteinLine: 21.95, carbsLine: 0.775, fatLine: 0.0  },

  { mealTemplateId: "base_midmorning",     nutritionPhaseId: "base", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "base_midmorning",     nutritionPhaseId: "base", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 26,  prepNote: "g",          kcalLine: 84.24,  proteinLine: 8.58,  carbsLine: 2.002, fatLine: 2.6  },
  { mealTemplateId: "base_midmorning",     nutritionPhaseId: "base", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 10,  prepNote: "g",          kcalLine: 37.6,   proteinLine: 8.78,  carbsLine: 0.31,  fatLine: 0.0  },

  { mealTemplateId: "base_proteinreserve", nutritionPhaseId: "base", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 12,  prepNote: "g",          kcalLine: 45.12,  proteinLine: 10.536,carbsLine: 0.372, fatLine: 0.0  },

  { mealTemplateId: "base_prelift",        nutritionPhaseId: "base", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 75,  prepNote: "g",          kcalLine: 290.25, proteinLine: 0.0,   carbsLine: 72.975,fatLine: 0.0  },
  { mealTemplateId: "base_prelift",        nutritionPhaseId: "base", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 15,  prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.465, fatLine: 0.0  },

  { mealTemplateId: "base_postlift",       nutritionPhaseId: "base", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 65,  prepNote: "g",          kcalLine: 251.55, proteinLine: 0.0,   carbsLine: 63.245,fatLine: 0.0  },
  { mealTemplateId: "base_postlift",       nutritionPhaseId: "base", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 30,  prepNote: "g",          kcalLine: 112.8,  proteinLine: 26.34, carbsLine: 0.93,  fatLine: 0.0  },

  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 100, prepNote: "g",          kcalLine: 400.0,  proteinLine: 13.3,  carbsLine: 60.0,  fatLine: 5.0  },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 24,  prepNote: "g",          kcalLine: 77.76,  proteinLine: 7.92,  carbsLine: 1.848, fatLine: 2.4  },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 3, ingredientId: "EGG",     amountUnit: 3,   prepNote: "whole eggs", kcalLine: 232.5,  proteinLine: 18.87, carbsLine: 1.68,  fatLine: 15.9 },
  { mealTemplateId: "base_evening",        nutritionPhaseId: "base", mealSlot: "evening",        lineNo: 4, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  // ─── CARB UP (2800 / 175p / 400c / 40f) ──────────────────────────────────
  { mealTemplateId: "carbup_precardio",      nutritionPhaseId: "carbup", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "carbup_postcardio",     nutritionPhaseId: "carbup", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 80,  prepNote: "g",          kcalLine: 320.0,  proteinLine: 10.64, carbsLine: 48.0,  fatLine: 4.0  },
  { mealTemplateId: "carbup_postcardio",     nutritionPhaseId: "carbup", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 24,  prepNote: "g",          kcalLine: 90.24,  proteinLine: 21.072,carbsLine: 0.744, fatLine: 0.0  },

  { mealTemplateId: "carbup_midmorning",     nutritionPhaseId: "carbup", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "carbup_midmorning",     nutritionPhaseId: "carbup", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 18,  prepNote: "g",          kcalLine: 58.32,  proteinLine: 5.94,  carbsLine: 1.386, fatLine: 1.8  },
  { mealTemplateId: "carbup_midmorning",     nutritionPhaseId: "carbup", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 10,  prepNote: "g",          kcalLine: 37.6,   proteinLine: 8.78,  carbsLine: 0.31,  fatLine: 0.0  },

  { mealTemplateId: "carbup_proteinreserve", nutritionPhaseId: "carbup", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 12,  prepNote: "g",          kcalLine: 45.12,  proteinLine: 10.536,carbsLine: 0.372, fatLine: 0.0  },

  { mealTemplateId: "carbup_prelift",        nutritionPhaseId: "carbup", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 120, prepNote: "g",          kcalLine: 464.4,  proteinLine: 0.0,   carbsLine: 116.76,fatLine: 0.0  },
  { mealTemplateId: "carbup_prelift",        nutritionPhaseId: "carbup", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 15,  prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.465, fatLine: 0.0  },

  { mealTemplateId: "carbup_postlift",       nutritionPhaseId: "carbup", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 105, prepNote: "g",          kcalLine: 406.35, proteinLine: 0.0,   carbsLine: 102.165,fatLine: 0.0  },
  { mealTemplateId: "carbup_postlift",       nutritionPhaseId: "carbup", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 29,  prepNote: "g",          kcalLine: 109.04, proteinLine: 25.462,carbsLine: 0.899, fatLine: 0.0  },

  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 95,  prepNote: "g",          kcalLine: 380.0,  proteinLine: 12.635,carbsLine: 57.0,  fatLine: 4.75 },
  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 2, ingredientId: "EGG",     amountUnit: 2,   prepNote: "whole eggs", kcalLine: 155.0,  proteinLine: 12.58, carbsLine: 1.12,  fatLine: 10.6 },
  { mealTemplateId: "carbup_evening",        nutritionPhaseId: "carbup", mealSlot: "evening",        lineNo: 3, ingredientId: "BANANA",  amountUnit: 1.5, prepNote: "whole",      kcalLine: 155.7,  proteinLine: 1.305, carbsLine: 37.68, fatLine: 0.51 },

  // ─── CARB CUT (2450 / 180p / 250c / 60f) ─────────────────────────────────
  { mealTemplateId: "carbcut_precardio",      nutritionPhaseId: "carbcut", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "carbcut_postcardio",     nutritionPhaseId: "carbcut", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 60,  prepNote: "g",          kcalLine: 240.0,  proteinLine: 7.98,  carbsLine: 36.0,  fatLine: 3.0  },
  { mealTemplateId: "carbcut_postcardio",     nutritionPhaseId: "carbcut", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 31,  prepNote: "g",          kcalLine: 116.56, proteinLine: 27.218,carbsLine: 0.961, fatLine: 0.0  },

  { mealTemplateId: "carbcut_midmorning",     nutritionPhaseId: "carbcut", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "carbcut_midmorning",     nutritionPhaseId: "carbcut", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 38,  prepNote: "g",          kcalLine: 123.12, proteinLine: 12.54, carbsLine: 2.926, fatLine: 3.8  },
  { mealTemplateId: "carbcut_midmorning",     nutritionPhaseId: "carbcut", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 12,  prepNote: "g",          kcalLine: 45.12,  proteinLine: 10.536,carbsLine: 0.372, fatLine: 0.0  },

  { mealTemplateId: "carbcut_proteinreserve", nutritionPhaseId: "carbcut", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 15,  prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.465, fatLine: 0.0  },

  { mealTemplateId: "carbcut_prelift",        nutritionPhaseId: "carbcut", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 35,  prepNote: "g",          kcalLine: 135.45, proteinLine: 0.0,   carbsLine: 34.055,fatLine: 0.0  },
  { mealTemplateId: "carbcut_prelift",        nutritionPhaseId: "carbcut", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,  prepNote: "g",          kcalLine: 75.2,   proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0  },

  { mealTemplateId: "carbcut_postlift",       nutritionPhaseId: "carbcut", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 50,  prepNote: "g",          kcalLine: 193.5,  proteinLine: 0.0,   carbsLine: 48.65, fatLine: 0.0  },
  { mealTemplateId: "carbcut_postlift",       nutritionPhaseId: "carbcut", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 37,  prepNote: "g",          kcalLine: 139.12, proteinLine: 32.486,carbsLine: 1.147, fatLine: 0.0  },

  { mealTemplateId: "carbcut_evening",        nutritionPhaseId: "carbcut", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 65,  prepNote: "g",          kcalLine: 260.0,  proteinLine: 8.645, carbsLine: 39.0,  fatLine: 3.25 },
  { mealTemplateId: "carbcut_evening",        nutritionPhaseId: "carbcut", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 32,  prepNote: "g",          kcalLine: 103.68, proteinLine: 10.56, carbsLine: 2.464, fatLine: 3.2  },
  { mealTemplateId: "carbcut_evening",        nutritionPhaseId: "carbcut", mealSlot: "evening",        lineNo: 3, ingredientId: "EGG",     amountUnit: 3,   prepNote: "whole eggs", kcalLine: 232.5,  proteinLine: 18.87, carbsLine: 1.68,  fatLine: 15.9 },
  { mealTemplateId: "carbcut_evening",        nutritionPhaseId: "carbcut", mealSlot: "evening",        lineNo: 4, ingredientId: "BANANA",  amountUnit: 0.5, prepNote: "whole",      kcalLine: 51.9,   proteinLine: 0.435, carbsLine: 12.56, fatLine: 0.17 },

  // ─── FAT CUT (2400 / 180p / 320c / 35f) ──────────────────────────────────
  { mealTemplateId: "fatcut_precardio",      nutritionPhaseId: "fatcut", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "fatcut_postcardio",     nutritionPhaseId: "fatcut", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 70,  prepNote: "g",          kcalLine: 280.0,  proteinLine: 9.31,  carbsLine: 42.0,  fatLine: 3.5  },
  { mealTemplateId: "fatcut_postcardio",     nutritionPhaseId: "fatcut", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 31,  prepNote: "g",          kcalLine: 116.56, proteinLine: 27.218,carbsLine: 0.961, fatLine: 0.0  },

  { mealTemplateId: "fatcut_midmorning",     nutritionPhaseId: "fatcut", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "fatcut_midmorning",     nutritionPhaseId: "fatcut", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 12,  prepNote: "g",          kcalLine: 38.88,  proteinLine: 3.96,  carbsLine: 0.924, fatLine: 1.2  },
  { mealTemplateId: "fatcut_midmorning",     nutritionPhaseId: "fatcut", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 12,  prepNote: "g",          kcalLine: 45.12,  proteinLine: 10.536,carbsLine: 0.372, fatLine: 0.0  },

  { mealTemplateId: "fatcut_proteinreserve", nutritionPhaseId: "fatcut", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 15,  prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.465, fatLine: 0.0  },

  { mealTemplateId: "fatcut_prelift",        nutritionPhaseId: "fatcut", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 75,  prepNote: "g",          kcalLine: 290.25, proteinLine: 0.0,   carbsLine: 72.975,fatLine: 0.0  },
  { mealTemplateId: "fatcut_prelift",        nutritionPhaseId: "fatcut", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,  prepNote: "g",          kcalLine: 75.2,   proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0  },

  { mealTemplateId: "fatcut_postlift",       nutritionPhaseId: "fatcut", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 95,  prepNote: "g",          kcalLine: 367.65, proteinLine: 0.0,   carbsLine: 92.435,fatLine: 0.0  },
  { mealTemplateId: "fatcut_postlift",       nutritionPhaseId: "fatcut", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 37,  prepNote: "g",          kcalLine: 139.12, proteinLine: 32.486,carbsLine: 1.147, fatLine: 0.0  },

  { mealTemplateId: "fatcut_evening",        nutritionPhaseId: "fatcut", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 80,  prepNote: "g",          kcalLine: 320.0,  proteinLine: 10.64, carbsLine: 48.0,  fatLine: 4.0  },
  { mealTemplateId: "fatcut_evening",        nutritionPhaseId: "fatcut", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 13,  prepNote: "g",          kcalLine: 42.12,  proteinLine: 4.29,  carbsLine: 1.001, fatLine: 1.3  },
  { mealTemplateId: "fatcut_evening",        nutritionPhaseId: "fatcut", mealSlot: "evening",        lineNo: 3, ingredientId: "EGG",     amountUnit: 2,   prepNote: "whole eggs", kcalLine: 155.0,  proteinLine: 12.58, carbsLine: 1.12,  fatLine: 10.6 },
  { mealTemplateId: "fatcut_evening",        nutritionPhaseId: "fatcut", mealSlot: "evening",        lineNo: 4, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  // ─── RECOMP (2575 / 180p / 300c / 50f) ───────────────────────────────────
  { mealTemplateId: "recomp_precardio",      nutritionPhaseId: "recomp", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "recomp_postcardio",     nutritionPhaseId: "recomp", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 70,  prepNote: "g",          kcalLine: 280.0,  proteinLine: 9.31,  carbsLine: 42.0,  fatLine: 3.5  },
  { mealTemplateId: "recomp_postcardio",     nutritionPhaseId: "recomp", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 31,  prepNote: "g",          kcalLine: 116.56, proteinLine: 27.218,carbsLine: 0.961, fatLine: 0.0  },

  { mealTemplateId: "recomp_midmorning",     nutritionPhaseId: "recomp", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "recomp_midmorning",     nutritionPhaseId: "recomp", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 26,  prepNote: "g",          kcalLine: 84.24,  proteinLine: 8.58,  carbsLine: 2.002, fatLine: 2.6  },
  { mealTemplateId: "recomp_midmorning",     nutritionPhaseId: "recomp", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 12,  prepNote: "g",          kcalLine: 45.12,  proteinLine: 10.536,carbsLine: 0.372, fatLine: 0.0  },

  { mealTemplateId: "recomp_proteinreserve", nutritionPhaseId: "recomp", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 15,  prepNote: "g",          kcalLine: 56.4,   proteinLine: 13.17, carbsLine: 0.465, fatLine: 0.0  },

  { mealTemplateId: "recomp_prelift",        nutritionPhaseId: "recomp", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 60,  prepNote: "g",          kcalLine: 232.2,  proteinLine: 0.0,   carbsLine: 58.38, fatLine: 0.0  },
  { mealTemplateId: "recomp_prelift",        nutritionPhaseId: "recomp", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,  prepNote: "g",          kcalLine: 75.2,   proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0  },

  { mealTemplateId: "recomp_postlift",       nutritionPhaseId: "recomp", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 70,  prepNote: "g",          kcalLine: 270.9,  proteinLine: 0.0,   carbsLine: 68.11, fatLine: 0.0  },
  { mealTemplateId: "recomp_postlift",       nutritionPhaseId: "recomp", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 37,  prepNote: "g",          kcalLine: 139.12, proteinLine: 32.486,carbsLine: 1.147, fatLine: 0.0  },

  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 80,  prepNote: "g",          kcalLine: 320.0,  proteinLine: 10.64, carbsLine: 48.0,  fatLine: 4.0  },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 22,  prepNote: "g",          kcalLine: 71.28,  proteinLine: 7.26,  carbsLine: 1.694, fatLine: 2.2  },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 3, ingredientId: "EGG",     amountUnit: 3,   prepNote: "whole eggs", kcalLine: 232.5,  proteinLine: 18.87, carbsLine: 1.68,  fatLine: 15.9 },
  { mealTemplateId: "recomp_evening",        nutritionPhaseId: "recomp", mealSlot: "evening",        lineNo: 4, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  // ─── DELOAD (2500 / 175p / 280c / 55f) ───────────────────────────────────
  { mealTemplateId: "deload_precardio",      nutritionPhaseId: "deload", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "deload_postcardio",     nutritionPhaseId: "deload", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 65,  prepNote: "g",          kcalLine: 260.0,  proteinLine: 8.645, carbsLine: 39.0,  fatLine: 3.25 },
  { mealTemplateId: "deload_postcardio",     nutritionPhaseId: "deload", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 27,  prepNote: "g",          kcalLine: 101.52, proteinLine: 23.706,carbsLine: 0.837, fatLine: 0.0  },

  { mealTemplateId: "deload_midmorning",     nutritionPhaseId: "deload", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "deload_midmorning",     nutritionPhaseId: "deload", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 32,  prepNote: "g",          kcalLine: 103.68, proteinLine: 10.56, carbsLine: 2.464, fatLine: 3.2  },
  { mealTemplateId: "deload_midmorning",     nutritionPhaseId: "deload", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 11,  prepNote: "g",          kcalLine: 41.36,  proteinLine: 9.658, carbsLine: 0.341, fatLine: 0.0  },

  { mealTemplateId: "deload_proteinreserve", nutritionPhaseId: "deload", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 13,  prepNote: "g",          kcalLine: 48.88,  proteinLine: 11.414,carbsLine: 0.403, fatLine: 0.0  },

  { mealTemplateId: "deload_prelift",        nutritionPhaseId: "deload", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 45,  prepNote: "g",          kcalLine: 174.15, proteinLine: 0.0,   carbsLine: 43.785,fatLine: 0.0  },
  { mealTemplateId: "deload_prelift",        nutritionPhaseId: "deload", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 18,  prepNote: "g",          kcalLine: 67.68,  proteinLine: 15.804,carbsLine: 0.558, fatLine: 0.0  },

  { mealTemplateId: "deload_postlift",       nutritionPhaseId: "deload", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 55,  prepNote: "g",          kcalLine: 212.85, proteinLine: 0.0,   carbsLine: 53.515,fatLine: 0.0  },
  { mealTemplateId: "deload_postlift",       nutritionPhaseId: "deload", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 31,  prepNote: "g",          kcalLine: 116.56, proteinLine: 27.218,carbsLine: 0.961, fatLine: 0.0  },

  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 75,  prepNote: "g",          kcalLine: 300.0,  proteinLine: 9.975, carbsLine: 45.0,  fatLine: 3.75 },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 28,  prepNote: "g",          kcalLine: 90.72,  proteinLine: 9.24,  carbsLine: 2.156, fatLine: 2.8  },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 3, ingredientId: "EGG",     amountUnit: 3,   prepNote: "whole eggs", kcalLine: 232.5,  proteinLine: 18.87, carbsLine: 1.68,  fatLine: 15.9 },
  { mealTemplateId: "deload_evening",        nutritionPhaseId: "deload", mealSlot: "evening",        lineNo: 4, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  // ─── DIET BREAK (2800 / 175p / 360c / 55f) ───────────────────────────────
  { mealTemplateId: "dietbreak_precardio",      nutritionPhaseId: "dietbreak", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "dietbreak_postcardio",     nutritionPhaseId: "dietbreak", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 80,  prepNote: "g",          kcalLine: 320.0,  proteinLine: 10.64, carbsLine: 48.0,  fatLine: 4.0  },
  { mealTemplateId: "dietbreak_postcardio",     nutritionPhaseId: "dietbreak", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 27,  prepNote: "g",          kcalLine: 101.52, proteinLine: 23.706,carbsLine: 0.837, fatLine: 0.0  },

  { mealTemplateId: "dietbreak_midmorning",     nutritionPhaseId: "dietbreak", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "dietbreak_midmorning",     nutritionPhaseId: "dietbreak", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 32,  prepNote: "g",          kcalLine: 103.68, proteinLine: 10.56, carbsLine: 2.464, fatLine: 3.2  },
  { mealTemplateId: "dietbreak_midmorning",     nutritionPhaseId: "dietbreak", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 11,  prepNote: "g",          kcalLine: 41.36,  proteinLine: 9.658, carbsLine: 0.341, fatLine: 0.0  },

  { mealTemplateId: "dietbreak_proteinreserve", nutritionPhaseId: "dietbreak", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 13,  prepNote: "g",          kcalLine: 48.88,  proteinLine: 11.414,carbsLine: 0.403, fatLine: 0.0  },

  { mealTemplateId: "dietbreak_prelift",        nutritionPhaseId: "dietbreak", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 70,  prepNote: "g",          kcalLine: 270.9,  proteinLine: 0.0,   carbsLine: 68.11, fatLine: 0.0  },
  { mealTemplateId: "dietbreak_prelift",        nutritionPhaseId: "dietbreak", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 18,  prepNote: "g",          kcalLine: 67.68,  proteinLine: 15.804,carbsLine: 0.558, fatLine: 0.0  },

  { mealTemplateId: "dietbreak_postlift",       nutritionPhaseId: "dietbreak", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 80,  prepNote: "g",          kcalLine: 309.6,  proteinLine: 0.0,   carbsLine: 77.84, fatLine: 0.0  },
  { mealTemplateId: "dietbreak_postlift",       nutritionPhaseId: "dietbreak", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 31,  prepNote: "g",          kcalLine: 116.56, proteinLine: 27.218,carbsLine: 0.961, fatLine: 0.0  },

  { mealTemplateId: "dietbreak_evening",        nutritionPhaseId: "dietbreak", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 90,  prepNote: "g",          kcalLine: 360.0,  proteinLine: 11.97, carbsLine: 54.0,  fatLine: 4.5  },
  { mealTemplateId: "dietbreak_evening",        nutritionPhaseId: "dietbreak", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 28,  prepNote: "g",          kcalLine: 90.72,  proteinLine: 9.24,  carbsLine: 2.156, fatLine: 2.8  },
  { mealTemplateId: "dietbreak_evening",        nutritionPhaseId: "dietbreak", mealSlot: "evening",        lineNo: 3, ingredientId: "EGG",     amountUnit: 3,   prepNote: "whole eggs", kcalLine: 232.5,  proteinLine: 18.87, carbsLine: 1.68,  fatLine: 15.9 },
  { mealTemplateId: "dietbreak_evening",        nutritionPhaseId: "dietbreak", mealSlot: "evening",        lineNo: 4, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  // ─── PEAK BULK (3000 / 180p / 420c / 55f) ────────────────────────────────
  { mealTemplateId: "peakbulk_precardio",      nutritionPhaseId: "peakbulk", mealSlot: "precardio",      lineNo: 1, ingredientId: "BANANA",  amountUnit: 1,   prepNote: "whole",      kcalLine: 103.8,  proteinLine: 0.87,  carbsLine: 25.12, fatLine: 0.34 },

  { mealTemplateId: "peakbulk_postcardio",     nutritionPhaseId: "peakbulk", mealSlot: "postcardio",     lineNo: 1, ingredientId: "OAT",     amountUnit: 85,  prepNote: "g",          kcalLine: 340.0,  proteinLine: 11.305,carbsLine: 51.0,  fatLine: 4.25 },
  { mealTemplateId: "peakbulk_postcardio",     nutritionPhaseId: "peakbulk", mealSlot: "postcardio",     lineNo: 2, ingredientId: "WHEY",    amountUnit: 30,  prepNote: "g",          kcalLine: 112.8,  proteinLine: 26.34, carbsLine: 0.93,  fatLine: 0.0  },

  { mealTemplateId: "peakbulk_midmorning",     nutritionPhaseId: "peakbulk", mealSlot: "midmorning",     lineNo: 1, ingredientId: "YOGURT",  amountUnit: 1,   prepNote: "cup",        kcalLine: 149.5,  proteinLine: 25.24, carbsLine: 8.91,  fatLine: 0.91 },
  { mealTemplateId: "peakbulk_midmorning",     nutritionPhaseId: "peakbulk", mealSlot: "midmorning",     lineNo: 2, ingredientId: "FLAX",    amountUnit: 32,  prepNote: "g",          kcalLine: 103.68, proteinLine: 10.56, carbsLine: 2.464, fatLine: 3.2  },
  { mealTemplateId: "peakbulk_midmorning",     nutritionPhaseId: "peakbulk", mealSlot: "midmorning",     lineNo: 3, ingredientId: "WHEY",    amountUnit: 12,  prepNote: "g",          kcalLine: 45.12,  proteinLine: 10.536,carbsLine: 0.372, fatLine: 0.0  },

  { mealTemplateId: "peakbulk_proteinreserve", nutritionPhaseId: "peakbulk", mealSlot: "proteinreserve", lineNo: 1, ingredientId: "WHEY",    amountUnit: 14,  prepNote: "g",          kcalLine: 52.64,  proteinLine: 12.292,carbsLine: 0.434, fatLine: 0.0  },

  { mealTemplateId: "peakbulk_prelift",        nutritionPhaseId: "peakbulk", mealSlot: "prelift",        lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 115, prepNote: "g",          kcalLine: 445.05, proteinLine: 0.0,   carbsLine: 111.895,fatLine: 0.0  },
  { mealTemplateId: "peakbulk_prelift",        nutritionPhaseId: "peakbulk", mealSlot: "prelift",        lineNo: 2, ingredientId: "WHEY",    amountUnit: 20,  prepNote: "g",          kcalLine: 75.2,   proteinLine: 17.56, carbsLine: 0.62,  fatLine: 0.0  },

  { mealTemplateId: "peakbulk_postlift",       nutritionPhaseId: "peakbulk", mealSlot: "postlift",       lineNo: 1, ingredientId: "DEXTRIN", amountUnit: 115, prepNote: "g",          kcalLine: 445.05, proteinLine: 0.0,   carbsLine: 111.895,fatLine: 0.0  },
  { mealTemplateId: "peakbulk_postlift",       nutritionPhaseId: "peakbulk", mealSlot: "postlift",       lineNo: 2, ingredientId: "WHEY",    amountUnit: 34,  prepNote: "g",          kcalLine: 127.84, proteinLine: 29.852,carbsLine: 1.054, fatLine: 0.0  },

  { mealTemplateId: "peakbulk_evening",        nutritionPhaseId: "peakbulk", mealSlot: "evening",        lineNo: 1, ingredientId: "OAT",     amountUnit: 100, prepNote: "g",          kcalLine: 400.0,  proteinLine: 13.3,  carbsLine: 60.0,  fatLine: 5.0  },
  { mealTemplateId: "peakbulk_evening",        nutritionPhaseId: "peakbulk", mealSlot: "evening",        lineNo: 2, ingredientId: "FLAX",    amountUnit: 28,  prepNote: "g",          kcalLine: 90.72,  proteinLine: 9.24,  carbsLine: 2.156, fatLine: 2.8  },
  { mealTemplateId: "peakbulk_evening",        nutritionPhaseId: "peakbulk", mealSlot: "evening",        lineNo: 3, ingredientId: "EGG",     amountUnit: 3,   prepNote: "whole eggs", kcalLine: 232.5,  proteinLine: 18.87, carbsLine: 1.68,  fatLine: 15.9 },
  { mealTemplateId: "peakbulk_evening",        nutritionPhaseId: "peakbulk", mealSlot: "evening",        lineNo: 4, ingredientId: "BANANA",  amountUnit: 1.5, prepNote: "whole",      kcalLine: 155.7,  proteinLine: 1.305, carbsLine: 37.68, fatLine: 0.51 },
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

// Reference daily targets by phase (from ground-truth spreadsheet)
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
