import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

interface MacroBarProps {
  protein: number;
  carbs: number;
  fat: number;
  kcal: number;
  compact?: boolean;
}

export function MacroBar({ protein, carbs, fat, kcal, compact = false }: MacroBarProps) {
  const total = protein * 4 + carbs * 4 + fat * 9;

  const proteinPct = total > 0 ? (protein * 4) / total : 0;
  const carbsPct = total > 0 ? (carbs * 4) / total : 0;
  const fatPct = total > 0 ? (fat * 9) / total : 0;

  return (
    <View>
      {!compact && (
        <View style={styles.kcalRow}>
          <Text style={styles.kcal}>{Math.round(kcal)}</Text>
          <Text style={styles.kcalLabel}> kcal</Text>
        </View>
      )}
      <View style={styles.barContainer}>
        <View style={[styles.segment, { flex: proteinPct, backgroundColor: Colors.light.structuring }]} />
        <View style={[styles.segment, { flex: carbsPct, backgroundColor: Colors.light.amber }]} />
        <View style={[styles.segment, { flex: fatPct, backgroundColor: Colors.light.rose }]} />
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: Colors.light.structuring }]} />
          <Text style={styles.legendText}>P {Math.round(protein)}g</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: Colors.light.amber }]} />
          <Text style={styles.legendText}>C {Math.round(carbs)}g</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: Colors.light.rose }]} />
          <Text style={styles.legendText}>F {Math.round(fat)}g</Text>
        </View>
        {compact && (
          <Text style={styles.kcalCompact}>{Math.round(kcal)} kcal</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kcalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  kcal: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  kcalLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  barContainer: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    gap: 2,
    marginBottom: 6,
  },
  segment: {
    borderRadius: 3,
    minWidth: 2,
  },
  legend: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  kcalCompact: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textTertiary,
    marginLeft: "auto",
  },
});
