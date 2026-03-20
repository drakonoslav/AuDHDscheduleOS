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

function minutesToHhmm(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function nudgeTime(hhmm: string, deltaMins: number): string {
  if (!hhmm.match(/^\d{2}:\d{2}$/)) {
    const now = new Date();
    const base = now.getHours() * 60 + now.getMinutes();
    return minutesToHhmm(base + deltaMins);
  }
  return minutesToHhmm(timeToMinutes(hhmm) + deltaMins);
}

function deriveDuration(start: string, end: string): number {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : 0;
}

// ─── Time nudger component ─────────────────────────────────────────────────────

interface TimeNudgerProps {
  label: string;
  value: string;
  plannedValue?: string;
  onChange: (val: string) => void;
}

function TimeNudger({ label, value, plannedValue, onChange }: TimeNudgerProps) {
  const nudge = (delta: number) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
    onChange(nudgeTime(value, delta));
  };

  const handleOnPlan = () => {
    if (!plannedValue) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    onChange(plannedValue);
  };

  const isOnPlan = !!plannedValue && value === plannedValue;

  return (
    <View style={nudgerStyles.container}>
      <View style={nudgerStyles.header}>
        <Text style={nudgerStyles.label}>{label}</Text>
        {plannedValue ? (
          <Pressable
            onPress={handleOnPlan}
            style={[nudgerStyles.onPlanChip, isOnPlan && nudgerStyles.onPlanChipActive]}
          >
            {isOnPlan && (
              <Feather name="check" size={10} color={Colors.light.sage} />
            )}
            <Text style={[nudgerStyles.onPlanText, isOnPlan && nudgerStyles.onPlanTextActive]}>
              {isOnPlan ? "On plan" : `On plan (${plannedValue})`}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={nudgerStyles.row}>
        <Pressable onPress={() => nudge(-5)} style={nudgerStyles.bigNudge} hitSlop={6}>
          <Text style={nudgerStyles.bigNudgeText}>−5</Text>
        </Pressable>
        <Pressable onPress={() => nudge(-1)} style={nudgerStyles.smallNudge} hitSlop={6}>
          <Text style={nudgerStyles.smallNudgeText}>−1</Text>
        </Pressable>
        <TextInput
          style={nudgerStyles.timeInput}
          value={value}
          onChangeText={onChange}
          placeholder="HH:MM"
          placeholderTextColor={Colors.light.textMuted}
          keyboardType="numbers-and-punctuation"
          textAlign="center"
        />
        <Pressable onPress={() => nudge(1)} style={nudgerStyles.smallNudge} hitSlop={6}>
          <Text style={nudgerStyles.smallNudgeText}>+1</Text>
        </Pressable>
        <Pressable onPress={() => nudge(5)} style={nudgerStyles.bigNudge} hitSlop={6}>
          <Text style={nudgerStyles.bigNudgeText}>+5</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TrainingLogScreen() {
  const insets = useSafeAreaInsets();
  const { state, today, addTrainingLog, trainingForDate } = useApp();
  const params = useLocalSearchParams<{ blockId?: string; date?: string; type?: string }>();

  const sourceBlock = useMemo(() => {
    if (params.blockId) {
      return state.blocks.find((b) => b.id === params.blockId) ?? null;
    }
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

  // ─── Derive planned end from block or from planned start + duration ────────
  const [plannedTime, setPlannedTime] = useState(
    () => sourceBlock?.plannedStart ?? "06:00"
  );
  const [duration, setDuration] = useState(() => {
    if (sourceBlock) {
      const d = deriveDuration(sourceBlock.plannedStart, sourceBlock.plannedEnd);
      return d > 0 ? d.toString() : "60";
    }
    return "60";
  });

  const plannedEnd = useMemo(() => {
    if (sourceBlock?.plannedEnd) return sourceBlock.plannedEnd;
    if (plannedTime.match(/^\d{2}:\d{2}$/)) {
      const dur = parseInt(duration) || 60;
      return minutesToHhmm(timeToMinutes(plannedTime) + dur);
    }
    return "";
  }, [sourceBlock, plannedTime, duration]);

  // ─── Form state ────────────────────────────────────────────────────────────
  const [type, setType] = useState<TrainingType>(() => {
    if (sourceBlock?.blockType === "cardio") return "cardio";
    if (sourceBlock?.blockType === "lift") return "lift";
    if (params.type === "cardio") return "cardio";
    return "lift";
  });
  // Actual start — pre-fill with planned start when block exists (on schedule)
  const [actualStart, setActualStart] = useState(
    () => sourceBlock?.plannedStart ?? ""
  );
  // Actual end — pre-fill with planned end when block exists
  const [actualTime, setActualTime] = useState(
    () => (sourceBlock?.plannedEnd ?? "")
  );
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

  // Auto-derive duration from actual start → actual end
  useEffect(() => {
    if (actualStart.match(/^\d{2}:\d{2}$/) && actualTime.match(/^\d{2}:\d{2}$/)) {
      const d = deriveDuration(actualStart, actualTime);
      if (d > 0) setDuration(d.toString());
    }
  }, [actualStart, actualTime]);

  const handleSave = () => {
    const log: TrainingLog = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      date: targetDate,
      type,
      plannedTime,
      actualStart: actualStart.trim() || undefined,
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
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    router.back();
  };

  // Adherence delta for display
  const adherenceDelta = useMemo(() => {
    if (!actualStart.match(/^\d{2}:\d{2}$/) || !plannedTime.match(/^\d{2}:\d{2}$/)) return null;
    return timeToMinutes(actualStart) - timeToMinutes(plannedTime);
  }, [actualStart, plannedTime]);

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
              {" "}({sourceBlock.plannedStart}–{sourceBlock.plannedEnd}).
              Nudge actuals if you ran early or late.
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
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
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

        {/* Planned reference row */}
        <View style={styles.plannedRow}>
          <Feather name="calendar" size={13} color={Colors.light.textMuted} />
          <Text style={styles.plannedLabel}>
            Planned: {plannedTime}
            {plannedEnd ? ` → ${plannedEnd}` : ""}
            {" "}
            <Text style={styles.plannedDuration}>({duration} min)</Text>
          </Text>
        </View>

        {/* Actual start nudger */}
        <TimeNudger
          label="Actual Start"
          value={actualStart}
          plannedValue={plannedTime}
          onChange={setActualStart}
        />

        {/* Actual end nudger */}
        <TimeNudger
          label="Actual End"
          value={actualTime}
          plannedValue={plannedEnd || undefined}
          onChange={setActualTime}
        />

        {/* Derived duration + adherence chip */}
        <View style={styles.durationRow}>
          <View style={styles.durationBox}>
            <Text style={styles.durationLabel}>Duration</Text>
            <View style={styles.durationValueRow}>
              <TextInput
                style={styles.durationInput}
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                textAlign="center"
              />
              <Text style={styles.durationUnit}>min</Text>
            </View>
          </View>
          {adherenceDelta !== null && (
            <View style={[
              styles.adherenceChip,
              adherenceDelta === 0
                ? styles.adherenceOnTime
                : adherenceDelta < 0
                ? styles.adherenceEarly
                : styles.adherenceLate,
            ]}>
              <Text style={styles.adherenceText}>
                {adherenceDelta === 0
                  ? "On plan"
                  : adherenceDelta < 0
                  ? `${Math.abs(adherenceDelta)}m early`
                  : `${adherenceDelta}m late`}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Intensity</Text>
        <View style={styles.intensityRow}>
          {(["low", "moderate", "high"] as Intensity[]).map((i) => (
            <Pressable
              key={i}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
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

        <Text style={styles.sectionTitle}>Session experience profile</Text>
        <Text style={styles.ratingNote}>
          Rate how the session felt in your body and mind — not how well it went.{"\n"}
          1 = minimal / absent{"   ·   "}3 = moderate / noticeable{"   ·   "}5 = strong / dominant
        </Text>
        <RatingSlider label="Initiation drive (pre-session)" value={motivationBefore} onChange={setMotivationBefore} />
        <RatingSlider label="Start friction (pre-session)" value={resistanceBefore} onChange={setResistanceBefore} inverted />
        <RatingSlider label="Session coherence (post-session)" value={satisfactionAfter} onChange={setSatisfactionAfter} />
        <RatingSlider label="Delayed fatigue load" value={laterFatigueCost} onChange={setLaterFatigueCost} inverted />
        <RatingSlider label="Sleep interference potential" value={bedtimeImpact} onChange={setBedtimeImpact} inverted />
        <RatingSlider label="Cognitive carryover" value={effectOnFocus} onChange={setEffectOnFocus} />
        <RatingSlider label="Nervous system settling" value={effectOnSensoryCalm} onChange={setEffectOnSensoryCalm} />

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

// ─── TimeNudger styles ─────────────────────────────────────────────────────────

const nudgerStyles = StyleSheet.create({
  container: { marginBottom: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  onPlanChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  onPlanChipActive: {
    backgroundColor: Colors.light.phaseStructuring,
    borderColor: Colors.light.sageLight,
  },
  onPlanText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  onPlanTextActive: {
    color: Colors.light.sage,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bigNudge: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bigNudgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  smallNudge: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.creamMid,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  smallNudgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  timeInput: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 12,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.light.text,
  },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────

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
  ratingNote: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary,
    lineHeight: 18, backgroundColor: Colors.light.creamMid, borderRadius: 8,
    padding: 10, marginBottom: 12,
  },
  plannedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.creamMid,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  plannedLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  plannedDuration: {
    fontFamily: "Inter_500Medium",
    color: Colors.light.textMuted,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  durationBox: {
    alignItems: "center",
  },
  durationLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  durationValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  durationInput: {
    width: 56,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingVertical: 8,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  durationUnit: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textMuted,
  },
  adherenceChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  adherenceOnTime: {
    backgroundColor: Colors.light.phaseStructuring,
    borderColor: Colors.light.sageLight,
  },
  adherenceEarly: {
    backgroundColor: "#E8F4FD",
    borderColor: "#B8D8F0",
  },
  adherenceLate: {
    backgroundColor: "#FEF3E8",
    borderColor: "#F5D5A8",
  },
  adherenceText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.text,
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
