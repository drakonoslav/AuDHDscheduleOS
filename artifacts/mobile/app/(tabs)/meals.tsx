import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MacroBar } from "@/components/ui/MacroBar";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { NUTRITION_PHASE_MAP } from "@/data/nutritionPhases";
import { NUTRITION_TO_ORBITAL } from "@/data/nutritionToOrbitalMap";
import { ORBITAL_PHASE_MAP } from "@/data/orbitalPhases";
import { getMealTemplatesForPhase, PHASE_DAILY_TARGETS } from "@/data/mealTemplates";
import type { NutritionPhaseId } from "@/types";

const ALL_PHASES: NutritionPhaseId[] = [
  "base", "carbup", "carbcut", "fatcut", "recomp", "deload", "dietbreak", "peakbulk",
];

export default function MealsScreen() {
  const insets = useSafeAreaInsets();
  const { state, setNutritionPhase } = useApp();
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [showPhasePicker, setShowPhasePicker] = useState(false);

  const currentPhaseId = state.currentNutritionPhaseId;
  const templates = useMemo(() => getMealTemplatesForPhase(currentPhaseId), [currentPhaseId]);
  const targets = PHASE_DAILY_TARGETS[currentPhaseId];
  const phase = NUTRITION_PHASE_MAP[currentPhaseId];
  const orbitalMap = NUTRITION_TO_ORBITAL[currentPhaseId];
  const orbital = orbitalMap ? ORBITAL_PHASE_MAP[orbitalMap.orbitalPhasePrimary] : null;
  const orbitalAlt = orbitalMap ? ORBITAL_PHASE_MAP[orbitalMap.orbitalPhaseSecondary] : null;

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Meals</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowPhasePicker((v) => !v);
          }}
          style={({ pressed }) => [styles.phaseBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.phaseBtnText}>{phase?.phaseName ?? currentPhaseId}</Text>
          <Feather name={showPhasePicker ? "chevron-up" : "chevron-down"} size={14} color={Colors.light.text} />
        </Pressable>
      </View>

      {showPhasePicker && (
        <View style={styles.phasePickerPanel}>
          <Text style={styles.phasePickerTitle}>Select Nutrition Regime</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phasePickerRow}>
            {ALL_PHASES.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNutritionPhase(p);
                  setShowPhasePicker(false);
                }}
                style={[styles.phaseChip, p === currentPhaseId && styles.phaseChipSelected]}
              >
                <Text style={[styles.phaseChipText, p === currentPhaseId && styles.phaseChipTextSelected]}>
                  {NUTRITION_PHASE_MAP[p]?.phaseName ?? p}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Orbital interpretation note */}
        {orbital && (
          <View style={styles.orbitalCard}>
            <View style={styles.orbitalHeader}>
              <Text style={styles.orbitalLabel}>Orbital Interpretation</Text>
              <Text style={styles.orbitalNote}>Not the same as nutrition regime</Text>
            </View>
            <View style={styles.orbitalRow}>
              <View style={styles.orbitalItem}>
                <Text style={styles.orbitalTag}>Primary</Text>
                <Text style={styles.orbitalName}>{orbital.orbitalPhaseName}</Text>
                <Text style={styles.orbitalDesc}>{orbital.description}</Text>
              </View>
              {orbitalAlt && (
                <View style={[styles.orbitalItem, styles.orbitalItemAlt]}>
                  <Text style={styles.orbitalTag}>Secondary</Text>
                  <Text style={[styles.orbitalName, { color: Colors.light.textSecondary }]}>
                    {orbitalAlt.orbitalPhaseName}
                  </Text>
                  <Text style={[styles.orbitalDesc, { color: Colors.light.textSecondary }]}>
                    {orbitalAlt.description}
                  </Text>
                </View>
              )}
            </View>
            {orbitalMap?.notes && (
              <Text style={styles.orbitalMapNote}>{orbitalMap.notes}</Text>
            )}
          </View>
        )}

        {/* Daily macro summary */}
        <View style={styles.macroCard}>
          <Text style={styles.macroCardTitle}>Daily Targets — {phase?.phaseName}</Text>
          <MacroBar
            kcal={targets.kcal}
            protein={targets.protein}
            carbs={targets.carbs}
            fat={targets.fat}
          />
        </View>

        {/* Meal slots */}
        <Text style={styles.sectionTitle}>Meal Slots</Text>
        <View style={styles.slotList}>
          {templates.map((tmpl) => {
            const isExpanded = expandedSlot === tmpl.templateId;
            return (
              <Pressable
                key={tmpl.templateId}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpandedSlot(isExpanded ? null : tmpl.templateId);
                }}
                style={({ pressed }) => [styles.slotCard, pressed && { opacity: 0.88 }]}
              >
                <View style={styles.slotHeader}>
                  <View>
                    <Text style={styles.slotLabel}>{tmpl.label}</Text>
                    <Text style={styles.slotDesc}>Slot {tmpl.slotOrder} · {tmpl.mealSlot}</Text>
                  </View>
                  <View style={styles.slotRight}>
                    <Text style={styles.slotKcal}>{Math.round(tmpl.totalKcal)} kcal</Text>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.light.textMuted} />
                  </View>
                </View>
                <MacroBar
                  kcal={tmpl.totalKcal}
                  protein={tmpl.totalProtein}
                  carbs={tmpl.totalCarbs}
                  fat={tmpl.totalFat}
                  compact
                />
                {isExpanded && (
                  <View style={styles.slotIngredients}>
                    <View style={styles.orbitalBadgeRow}>
                      <View style={styles.orbitalBadge}>
                        <Text style={styles.orbitalBadgeText}>→ {ORBITAL_PHASE_MAP[tmpl.orbitalPhasePrimary]?.orbitalPhaseName}</Text>
                      </View>
                      <View style={[styles.orbitalBadge, { backgroundColor: Colors.light.creamMid }]}>
                        <Text style={[styles.orbitalBadgeText, { color: Colors.light.textSecondary }]}>
                          alt: {ORBITAL_PHASE_MAP[tmpl.orbitalPhaseSecondary]?.orbitalPhaseName}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.ingredientTable}>
                      <View style={styles.ingredientRow}>
                        <Text style={[styles.ingredientCell, styles.ingredientHeader]}>Ingredient</Text>
                        <Text style={[styles.ingredientCell, styles.ingredientHeader, styles.cellRight]}>Amt</Text>
                        <Text style={[styles.ingredientCell, styles.ingredientHeader, styles.cellRight]}>P</Text>
                        <Text style={[styles.ingredientCell, styles.ingredientHeader, styles.cellRight]}>C</Text>
                        <Text style={[styles.ingredientCell, styles.ingredientHeader, styles.cellRight]}>F</Text>
                      </View>
                      {tmpl.lines.map((line) => (
                        <View key={`${line.mealTemplateId}_${line.lineNo}`} style={styles.ingredientRow}>
                          <Text style={styles.ingredientCell}>{line.ingredientId}</Text>
                          <Text style={[styles.ingredientCell, styles.cellRight]}>
                            {line.amountUnit % 1 === 0 ? line.amountUnit : line.amountUnit.toFixed(1)}{line.prepNote !== "whole" && line.prepNote !== "cup" && line.prepNote !== "egg" ? line.prepNote.charAt(0) : ""}
                          </Text>
                          <Text style={[styles.ingredientCell, styles.cellRight]}>{line.proteinLine.toFixed(1)}</Text>
                          <Text style={[styles.ingredientCell, styles.cellRight]}>{line.carbsLine.toFixed(1)}</Text>
                          <Text style={[styles.ingredientCell, styles.cellRight]}>{line.fatLine.toFixed(1)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Phase description */}
        <View style={styles.phaseDescCard}>
          <Text style={styles.phaseDescTitle}>{phase?.phaseName}</Text>
          <Text style={styles.phaseDesc}>{phase?.description}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.light.text, letterSpacing: -0.5 },
  phaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  phaseBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text },
  phasePickerPanel: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  phasePickerTitle: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  phasePickerRow: { gap: 6 },
  phaseChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.light.creamMid,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  phaseChipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  phaseChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  phaseChipTextSelected: { color: Colors.light.surface },
  scroll: { paddingHorizontal: 16 },
  orbitalCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.navyLight,
    padding: 14,
    marginBottom: 10,
  },
  orbitalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  orbitalLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text },
  orbitalNote: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, fontStyle: "italic" },
  orbitalRow: { flexDirection: "row", gap: 10 },
  orbitalItem: { flex: 1 },
  orbitalItemAlt: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    paddingLeft: 10,
  },
  orbitalTag: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  orbitalName: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.text, marginBottom: 2 },
  orbitalDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary },
  orbitalMapNote: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted, marginTop: 8, fontStyle: "italic" },
  macroCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 14,
  },
  macroCardTitle: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.text, marginBottom: 8 },
  slotList: { gap: 6, marginBottom: 12 },
  slotCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
  },
  slotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  slotLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  slotDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted, marginTop: 1 },
  slotRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  slotKcal: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.textSecondary },
  slotIngredients: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 10 },
  orbitalBadgeRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  orbitalBadge: {
    backgroundColor: Colors.light.navyLight + "18",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  orbitalBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.navyLight },
  ingredientTable: {},
  ingredientRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  ingredientCell: { flex: 1.5, fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  ingredientHeader: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.textMuted, textTransform: "uppercase" },
  cellRight: { flex: 1, textAlign: "right" },
  phaseDescCard: {
    backgroundColor: Colors.light.creamMid,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  phaseDescTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text, marginBottom: 4 },
  phaseDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
});
