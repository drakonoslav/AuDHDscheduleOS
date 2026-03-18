import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { SchedulePhaseTag } from "@/types";
import { RatingSlider } from "./RatingSlider";

export interface PhaseAxes {
  novelty: number;    // 1=repetitive/known  → 5=new/creative/uncertain
  structure: number;  // 1=loose/flexible    → 5=rigid/step-by-step
  recovery: number;   // 1=restorative       → 5=highly demanding
}

// ─── Classification rule ──────────────────────────────────────────────────────
// Recovery axis gates first: if a block is highly draining it belongs in recovery
// regardless of novelty vs structure balance.
export function derivePhaseTag(axes: PhaseAxes): SchedulePhaseTag {
  if (axes.recovery >= 4) return "recovery";
  if (axes.novelty >= axes.structure) return "expansion";
  return "structuring";
}

const TAG_LABELS: Record<SchedulePhaseTag, string> = {
  expansion: "Expansion",
  structuring: "Structuring",
  recovery: "Recovery",
};

const TAG_COLORS: Record<SchedulePhaseTag, { bg: string; border: string; text: string }> = {
  expansion:   { bg: "#F4E8D8", border: Colors.light.amber,      text: Colors.light.amber      },
  structuring: { bg: "#DCF0E6", border: Colors.light.structuring, text: Colors.light.structuring },
  recovery:    { bg: "#DCE8F4", border: "#7A9CC4",                text: "#4A6C8C"               },
};

const TAG_EXPLANATIONS: Record<SchedulePhaseTag, string> = {
  expansion:   "High novelty, output-driven. Best when dopamine availability is high.",
  structuring: "Routine, predictable. Suits autism-dominant states and low cognitive overhead.",
  recovery:    "Restorative or highly draining. Protect this block from interruption.",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface PhaseClassifierProps {
  axes: PhaseAxes;
  onChange: (next: PhaseAxes) => void;
}

export function PhaseClassifier({ axes, onChange }: PhaseClassifierProps) {
  const derived = derivePhaseTag(axes);
  const colors = TAG_COLORS[derived];

  return (
    <View style={styles.container}>
      <RatingSlider
        label="Novelty demand — how much exploration does this require?"
        sublabel="1 = repetitive / known   ·   5 = new / creative / uncertain"
        value={axes.novelty}
        onChange={(v) => onChange({ ...axes, novelty: v })}
      />
      <RatingSlider
        label="Structure demand — how much predictability does it need?"
        sublabel="1 = loose / flexible   ·   5 = rigid / step-by-step"
        value={axes.structure}
        onChange={(v) => onChange({ ...axes, structure: v })}
      />
      <RatingSlider
        label="Recovery support needed — how draining vs restorative is this?"
        sublabel="1 = restorative   ·   5 = highly demanding"
        value={axes.recovery}
        onChange={(v) => onChange({ ...axes, recovery: v })}
        inverted
      />

      {/* Derived result */}
      <View style={[styles.resultCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Classified as</Text>
          <View style={[styles.resultTag, { backgroundColor: colors.border + "22", borderColor: colors.border }]}>
            <Text style={[styles.resultTagText, { color: colors.text }]}>
              {TAG_LABELS[derived]}
            </Text>
          </View>
        </View>
        <Text style={[styles.resultExplanation, { color: colors.text }]}>
          {TAG_EXPLANATIONS[derived]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  resultCard: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    gap: 5,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  resultTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  resultTagText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  resultExplanation: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.85,
  },
});
