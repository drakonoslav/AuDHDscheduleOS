import type { Ingredient } from "@/types";

export const INGREDIENTS: Ingredient[] = [
  {
    ingredientId: "MCT",
    ingredientName: "MCT Oil",
    unitType: "g",
    kcalPerUnit: 7.1,
    proteinPerUnit: 0.0,
    carbsPerUnit: 0.0,
    fatPerUnit: 0.8,
  },
  {
    ingredientId: "FLAX",
    ingredientName: "Flax Powder",
    unitType: "g",
    kcalPerUnit: 3.24,
    proteinPerUnit: 0.33,
    carbsPerUnit: 0.077,
    fatPerUnit: 0.1,
  },
  {
    ingredientId: "OAT",
    ingredientName: "Oat Flour",
    unitType: "g",
    kcalPerUnit: 4.0,
    proteinPerUnit: 0.133,
    carbsPerUnit: 0.6,
    fatPerUnit: 0.05,
  },
  {
    ingredientId: "DEXTRIN",
    ingredientName: "Cyclic Dextrin",
    unitType: "g",
    kcalPerUnit: 3.87,
    proteinPerUnit: 0.0,
    carbsPerUnit: 0.973,
    fatPerUnit: 0.0,
  },
  {
    ingredientId: "WHEY",
    ingredientName: "Whey Isolate",
    unitType: "g",
    kcalPerUnit: 3.76,
    proteinPerUnit: 0.878,
    carbsPerUnit: 0.031,
    fatPerUnit: 0.0,
  },
  {
    ingredientId: "YOGURT",
    ingredientName: "Greek Yogurt Nonfat",
    unitType: "cup",
    kcalPerUnit: 149.5,
    proteinPerUnit: 25.24,
    carbsPerUnit: 8.91,
    fatPerUnit: 0.91,
  },
  {
    ingredientId: "BANANA",
    ingredientName: "Banana",
    unitType: "banana",
    kcalPerUnit: 103.8,
    proteinPerUnit: 0.87,
    carbsPerUnit: 25.12,
    fatPerUnit: 0.34,
  },
  {
    ingredientId: "EGG",
    ingredientName: "Whole Egg",
    unitType: "egg",
    kcalPerUnit: 77.5,
    proteinPerUnit: 6.29,
    carbsPerUnit: 0.56,
    fatPerUnit: 5.3,
  },
];

export const INGREDIENT_MAP = Object.fromEntries(
  INGREDIENTS.map((i) => [i.ingredientId, i])
);
