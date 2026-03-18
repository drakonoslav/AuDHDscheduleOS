import type { NutritionPhase } from "@/types";

export const NUTRITION_PHASES: NutritionPhase[] = [
  {
    phaseId: "base",
    phaseName: "Base",
    description: "Standard bulk baseline — stabilized operating point, not pushing hard in any direction.",
  },
  {
    phaseId: "carbup",
    phaseName: "Carb-Up",
    description: "High carbohydrate push — increasing fuel pressure and training support.",
  },
  {
    phaseId: "carbcut",
    phaseName: "Carb-Cut",
    description: "Carbohydrate reduction — careful fuel allocation, improved nutrient routing.",
  },
  {
    phaseId: "fatcut",
    phaseName: "Fat-Cut",
    description: "Fat reduction — allocation/routing regime to reduce excess storage pressure.",
  },
  {
    phaseId: "recomp",
    phaseName: "Recomp",
    description: "Slow recomposition — routing nutrients toward muscle while controlling fat.",
  },
  {
    phaseId: "deload",
    phaseName: "Deload",
    description: "Recovery nutrition — reduced strain, restored sensitivity and CNS recovery.",
  },
  {
    phaseId: "dietbreak",
    phaseName: "Diet Break",
    description: "Metabolic reset — relieves adaptive suppression and restores performance output.",
  },
  {
    phaseId: "peakbulk",
    phaseName: "Peak Bulk",
    description: "Aggressive growth — highest surplus and carbohydrate pressure, strongest hypertrophy drive.",
  },
];

export const NUTRITION_PHASE_MAP = Object.fromEntries(
  NUTRITION_PHASES.map((p) => [p.phaseId, p])
);
