import type { NutritionToOrbitalMap } from "@/types";

// Translator table: nutrition regime → orbital physiology interpretation
// These are NOT the same concept. This is a lookup layer only.
export const NUTRITION_TO_ORBITAL_MAP: NutritionToOrbitalMap[] = [
  {
    nutritionPhaseId: "base",
    orbitalPhasePrimary: "expression",
    orbitalPhaseSecondary: "priming",
    notes: "Stabilized baseline — not pushing hard, not resetting hard. System at expression.",
  },
  {
    nutritionPhaseId: "carbup",
    orbitalPhasePrimary: "loading",
    orbitalPhaseSecondary: "accumulation",
    notes: "Fuel increase and rising training support. Can drift to accumulation if sustained.",
  },
  {
    nutritionPhaseId: "carbcut",
    orbitalPhasePrimary: "partitioning",
    orbitalPhaseSecondary: "resensitization",
    notes: "Less fuel availability, more careful allocation. Moves toward resensitization if substantial.",
  },
  {
    nutritionPhaseId: "fatcut",
    orbitalPhasePrimary: "partitioning",
    orbitalPhaseSecondary: "resensitization",
    notes: "Reduce excess storage pressure, improve nutrient direction. Same logic as carbcut.",
  },
  {
    nutritionPhaseId: "recomp",
    orbitalPhasePrimary: "partitioning",
    orbitalPhaseSecondary: "expression",
    notes: "Routing nutrients toward muscle while controlling fat. Stable controlled state.",
  },
  {
    nutritionPhaseId: "deload",
    orbitalPhasePrimary: "resensitization",
    orbitalPhaseSecondary: "priming",
    notes: "Reduced strain, restored sensitivity. System becomes ready again after recovery.",
  },
  {
    nutritionPhaseId: "dietbreak",
    orbitalPhasePrimary: "rebound",
    orbitalPhaseSecondary: "expression",
    notes: "Relieve adaptive suppression, restore output. Softer version leans to expression.",
  },
  {
    nutritionPhaseId: "peakbulk",
    orbitalPhasePrimary: "saturation",
    orbitalPhaseSecondary: "accumulation",
    notes: "Most aggressive growth push. Highest surplus and fatigue risk.",
  },
];

export const NUTRITION_TO_ORBITAL = Object.fromEntries(
  NUTRITION_TO_ORBITAL_MAP.map((m) => [m.nutritionPhaseId, m])
);

export function getOrbitalForNutrition(nutritionPhaseId: string) {
  return NUTRITION_TO_ORBITAL[nutritionPhaseId] ?? null;
}
