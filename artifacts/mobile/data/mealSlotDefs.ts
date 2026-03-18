import type { MealSlotDef } from "@/types";

export const MEAL_SLOT_DEFS: MealSlotDef[] = [
  {
    mealSlot: "precardio",
    slotOrder: 1,
    label: "Pre-Cardio",
    description: "Light activation fuel. Low digestive drag, readiness and wake-up.",
  },
  {
    mealSlot: "postcardio",
    slotOrder: 2,
    label: "Post-Cardio",
    description: "Recovery and substrate reset. Begins substrate restoration and sets the day.",
  },
  {
    mealSlot: "midmorning",
    slotOrder: 3,
    label: "Mid-Morning",
    description: "Stable anchor meal. Steady, controlled, routing and maintenance oriented.",
  },
  {
    mealSlot: "prelift",
    slotOrder: 4,
    label: "Pre-Lift",
    description: "Training fuel. Explicit fuel input before major tension work.",
  },
  {
    mealSlot: "postlift",
    slotOrder: 5,
    label: "Post-Lift",
    description: "Training recovery feed. Absorb the stimulus, begin supercompensation.",
  },
  {
    mealSlot: "evening",
    slotOrder: 6,
    label: "Evening",
    description: "Grounding and overnight support. Nervous system settling, overnight restoration.",
  },
  {
    mealSlot: "proteinreserve",
    slotOrder: 7,
    label: "Protein Reserve",
    description: "Flexible protein buffer. Used as needed to hit daily targets.",
  },
];

export const MEAL_SLOT_MAP = Object.fromEntries(
  MEAL_SLOT_DEFS.map((s) => [s.mealSlot, s])
);

// Parse a meal_template_id into its components
// e.g. "base_precardio" → { nutritionPhaseId: "base", mealSlot: "precardio" }
export function parseMealTemplateId(templateId: string): {
  nutritionPhaseId: string;
  mealSlot: string;
} | null {
  const parts = templateId.split("_");
  if (parts.length < 2) return null;
  const mealSlot = parts[parts.length - 1];
  const nutritionPhaseId = parts.slice(0, parts.length - 1).join("_");
  return { nutritionPhaseId, mealSlot };
}
