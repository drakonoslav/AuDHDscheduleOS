import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RatingSlider } from "@/components/ui/RatingSlider";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { TrainingLog } from "@/types";

type TrainingType = "cardio" | "lift";
type Intensity = "low" | "moderate" | "high";

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function deriveDuration(start: string, end: string): number {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : 0;
}

export default function TrainingLogScreen() {
  const insets = useSafeAreaInsets();
  const { state, today, addTrainingLog, trainingForDate } = useApp();
  const params = useLocalSearchParams<{ blockId?: string; date?: string; type?: string }>();

  // ─── Derive pre-fill from block params ───────────────────────────────────────
  const sourceBlock = useMemo(() => {
    if (params.blockId) {
      return state.blocks.find((b) => b.id === params.blockId) ?? null;
    }
    // Auto-match: find the first unlogged cardio/lift block for the target date
    const targetDate = params.date ?? today;
    const existing = trainingForDate(targetDate);
    const blocksForDay = state.blocks.filter((b) => b.date === targetDate);
    return (
      blocksForDay.find(
        (b) =>
          (b.blockType === "cardio" || b.blockType === "lift") &&
          !existing.some(
            (l) => l.plannedTime === b.plannedStart && l.type === b.blockType
          )
      ) ?? null
    );
  }, [params.blockId, params.date, state.blocks, today, trainingForDate]);

  const preFilled = sourceBlock !== null;
  const targetDate = params.date ?? today;

  // ─── Form state — initialised once from sourceBlock or defaults ───────────────
  const [type, setType] = useState<TrainingType>(() => {
    if (sourceBlock?.blockType === "cardio") return "cardio";
    if (sourceBlock?.blockType === "lift") return "lift";
    if (params.type === "cardio") return "cardio";
    return "lift";
  });
  const [plannedTime, setPlannedTime] = useState(
    () => sourceBlock?.plannedStart ?? "06:00"
  );
  const [actualTime, setActualTime] = useState(
    () => sourceBlock?.actualStart ?? ""
  );
  const [duration, setDuration] = useState(() => {
    if (sourceBlock) {
      const d = deriveDuration(sourceBlock.plannedStart, sourceBlock.plannedEnd);
      return d > 0 ? d.toString() : "60";
    }
    return "60";
  });
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [preLiftMeal, setPreLiftMeal] = useState("45");
  const [postLiftMeal, setPostLiftMeal] = useState("30");
  const [motivationBefore, setMotivationBefore] = useState(0);
  const [resistanceBefore, setResistanceBefore] = useState(0);
  const [satisfactionAfter, setSatisfactionAfter] = useState(0);
  const [laterFatigueCost, setLaterFatigueCost] = useState(0);
  const [bedtimeImpact, setBedtimeImpact] = useState(0);
  const [effectOnFocus, setEffectOnFocus] = useState(0);
  const [effectOnSensoryCalm, setEffectOnSensoryCalm] = useState(0);
  const [notes, setNotes] = useState("");

  const existing = trainingForDate(targetDate);

  // Auto-derive duration when user enters a valid actual end time
  useEffect(() => {
    if (
      actualTime.match(/^\d{2}:\d{2}$/) &&
      plannedTime.match(/^\d{2}:\d{2}$/)
    ) {
      const d = deriveDuration(plannedTime, actualTime);
      if (d > 0) setDuration(d.toString());
    }
  }, [actualTime, plannedTime]);

  const handleSave = () => {
    const log: TrainingLog = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      date: targetDate,
      type,
      plannedTime,
      actualTime: actualTime.trim() || undefined,
      duration: parseInt(duration) || undefined,
      intensity,
      preLiftMealTiming: parseInt(preLiftMeal) || undefined,
      postLiftMealTiming: parseInt(postLiftMeal) || undefined,
      motivationBefore: motivationBefore || undefined,
      resistanceBefore: resistanceBefore || undefined,
      satisfactionAfter: satisfactionAfter || undefined,
      laterFatigueCost: laterFatigueCost || undefined,
      bedtimeImpact: bedtimeImpact || undefined,
      effectOnFocus: effectOnFocus || undefined,
      effectOnSensoryCalm: effectOnSensoryCalm || undefined,
      notes: notes.trim() || undefined,
    };
    addTrainingLog(log);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.title}>Training Log</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Pre-fill notice */}
        {preFilled && sourceBlock && (
          <View style={styles.preFillBanner}>
            <Feather name="link" size={13} color={Colors.light.structuring} />
            <Text style={styles.preFillText}>
              Pre-filled from{" "}
              <Text style={styles.preFillBlock}>"{sourceBlock.label}"</Text>
              {" "}— {sourceBlock.plannedStart}–{sourceBlock.plannedEnd}. Adjust anything that changed.
            </Text>
          </View>
        )}

        {/* Already logged today */}
        {existing.length > 0 && (
          <View style={styles.existingCard}>
            <Text style={styles.existingTitle}>
              Already logged for this day ({existing.length})
            </Text>
            {existing.map((l) => (
              <Text key={l.id} style={styles.existingItem}>
                {l.type.toUpperCase()} · {l.plannedTime} · {l.intensity ?? "—"} · {l.duration ?? "—"} min
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Session Type</Text>
        <View style={styles.typeRow}>
          {(["cardio", "lift"] as TrainingType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setType(t);
              }}
              style={[styles.typeChip, type === t && styles.typeChipSelected]}
            >
              <Feather
                name={t === "cardio" ? "activity" : "zap"}
                size={16}
                color={type === t ? Colors.light.surface : Colors.light.textSecondary}
              />
              <Text style={[styles.typeText, type === t && styles.typeTextSelected]}>
                {t === "cardio" ? "Cardio" : "Lift"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Timing</Text>

        {/* Planned time is pre-filled — show inline label when it came from a block */}
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>
              Planned{preFilled ? " (from block)" : ""}
            </Text>
            <TextInput
              style={[styles.textInput, preFilled && styles.textInputPrefilled]}
              value={plannedTime}
              onChangeText={setPlannedTime}
              placeholder="HH:MM"
              placeholderTextColor={Colors.light.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Actual End</Text>
            <TextInput
              style={styles.textInput}
              value={actualTime}
              onChangeText={setActualTime}
              placeholder="HH:MM"
              placeholderTextColor={Colors.light.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Duration (min)</Text>
            <TextInput
              style={styles.textInput}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Intensity</Text>
        <View style={styles.intensityRow}>
          {(["low", "moderate", "high"] as Intensity[]).map((i) => (
            <Pressable
              key={i}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIntensity(i);
              }}
              style={[styles.intensityChip, intensity === i && styles.intensityChipSelected]}
            >
              <Text style={[styles.intensityText, intensity === i && styles.intensityTextSelected]}>
                {i.charAt(0).toUpperCase() + i.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Meal Timing</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Pre-session (min before)</Text>
            <TextInput
              style={styles.textInput}
              value={preLiftMeal}
              onChangeText={setPreLiftMeal}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Post-session (min after)</Text>
            <TextInput
              style={styles.textInput}
              value={postLiftMeal}
              onChangeText={setPostLiftMeal}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ratings</Text>
        <RatingSlider label="Motivation before" value={motivationBefore} onChange={setMotivationBefore} />
        <RatingSlider label="Resistance before" value={resistanceBefore} onChange={setResistanceBefore} inverted />
        <RatingSlider label="Satisfaction after" value={satisfactionAfter} onChange={setSatisfactionAfter} />
        <RatingSlider label="Later fatigue cost" value={laterFatigueCost} onChange={setLaterFatigueCost} inverted />
        <RatingSlider label="Bedtime impact" value={bedtimeImpact} onChange={setBedtimeImpact} inverted />
        <RatingSlider label="Effect on focus" value={effectOnFocus} onChange={setEffectOnFocus} />
        <RatingSlider label="Effect on sensory calm" value={effectOnSensoryCalm} onChange={setEffectOnSensoryCalm} />

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="How did this session feel overall?"
          placeholderTextColor={Colors.light.textMuted}
          multiline
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>Log Session</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.light.text,
    textAlign: "center",
  },
  scroll: { paddingHorizontal: 16 },
  preFillBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.light.phaseStructuring,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.structuring,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  preFillText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  preFillBlock: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  existingCard: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  existingTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  existingItem: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    paddingBottom: 6,
  },
  typeRow: { flexDirection: "row", gap: 10 },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  typeChipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  typeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  typeTextSelected: { color: Colors.light.surface },
  intensityRow: { flexDirection: "row", gap: 8 },
  intensityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
  },
  intensityChipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  intensityText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  intensityTextSelected: { color: Colors.light.surface },
  timeRow: { flexDirection: "row", gap: 8 },
  timeField: { flex: 1 },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.text,
  },
  textInputPrefilled: {
    backgroundColor: Colors.light.phaseStructuring,
    borderColor: Colors.light.sageLight,
  },
  notesInput: { height: 80, textAlignVertical: "top", marginTop: 6 },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.light.surface,
  },
});
