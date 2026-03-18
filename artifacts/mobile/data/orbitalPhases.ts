import type { OrbitalPhase } from "@/types";

export const ORBITAL_PHASES: OrbitalPhase[] = [
  {
    orbitalPhaseId: "priming",
    orbitalPhaseName: "Priming",
    orbitalOrder: 1,
    description: "Readiness and system preparation. Light activation, low digestive drag.",
  },
  {
    orbitalPhaseId: "loading",
    orbitalPhaseName: "Loading",
    orbitalOrder: 2,
    description: "Force production rising. Fuel input increasing to support training tension.",
  },
  {
    orbitalPhaseId: "accumulation",
    orbitalPhaseName: "Accumulation",
    orbitalOrder: 3,
    description: "Absorbing the training stimulus. Substrate restoration in progress.",
  },
  {
    orbitalPhaseId: "saturation",
    orbitalPhaseName: "Saturation",
    orbitalOrder: 4,
    description: "Maximum cellular stress. Highest carb pressure, peak hypertrophy drive.",
  },
  {
    orbitalPhaseId: "partitioning",
    orbitalPhaseName: "Partitioning",
    orbitalOrder: 5,
    description: "Directing nutrients toward muscle vs fat. Efficient allocation, routing control.",
  },
  {
    orbitalPhaseId: "resensitization",
    orbitalPhaseName: "Resensitization",
    orbitalOrder: 6,
    description: "Restoring receptor sensitivity, CNS recovery. Overnight restoration.",
  },
  {
    orbitalPhaseId: "rebound",
    orbitalPhaseName: "Rebound",
    orbitalOrder: 7,
    description: "Supercompensation expression. Relieving adaptive suppression, restoring output.",
  },
  {
    orbitalPhaseId: "expression",
    orbitalPhaseName: "Expression",
    orbitalOrder: 8,
    description: "System stabilized at higher baseline. Controlled, not pushing hard.",
  },
];

export const ORBITAL_PHASE_MAP = Object.fromEntries(
  ORBITAL_PHASES.map((p) => [p.orbitalPhaseId, p])
);
