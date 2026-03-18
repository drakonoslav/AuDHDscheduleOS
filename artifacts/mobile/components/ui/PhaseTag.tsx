import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SchedulePhaseTag } from "@/types";
import { Colors } from "@/constants/colors";

const PHASE_LABELS: Record<SchedulePhaseTag, string> = {
  expansion: "Expansion",
  structuring: "Structuring",
  recovery: "Recovery",
};

const PHASE_COLORS: Record<SchedulePhaseTag, { bg: string; text: string }> = {
  expansion: { bg: Colors.light.phaseExpansion, text: Colors.light.expansion },
  structuring: { bg: Colors.light.phaseStructuring, text: Colors.light.structuring },
  recovery: { bg: Colors.light.phaseRecovery, text: Colors.light.recovery },
};

interface PhaseTagProps {
  phase: SchedulePhaseTag;
  small?: boolean;
}

export function PhaseTag({ phase, small = false }: PhaseTagProps) {
  const colors = PHASE_COLORS[phase];
  return (
    <View style={[styles.tag, { backgroundColor: colors.bg }, small && styles.small]}>
      <Text style={[styles.text, { color: colors.text }, small && styles.smallText]}>
        {PHASE_LABELS[phase]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  smallText: {
    fontSize: 10,
  },
});
