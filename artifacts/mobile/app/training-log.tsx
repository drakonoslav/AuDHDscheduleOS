import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
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

export default function TrainingLogScreen() {
  const insets = useSafeAreaInsets();
  const { today, addTrainingLog, trainingForDate } = useApp();

  const existing = trainingForDate(today);

  const [type, setType] = useState<TrainingType>("lift");
  const [plannedTime, setPlannedTime] = useState("06:00");
  const [actualTime, setActualTime] = useState("");
  const [duration, setDuration] = useState("60");
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

  const handleSave = () => {
    const log: TrainingLog = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      date: today,
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
        {/* Today's training */}
        {existing.length > 0 && (
          <View style={styles.existingCard}>
            <Text style={styles.existingTitle}>Logged today ({existing.length})</Text>
            {existing.map((l) => (
              <Text key={l.id} style={styles.existingItem}>
                {l.type.toUpperCase()} · {l.plannedTime} · {l.intensity ?? "—"} · {l.duration ?? "—"}min
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
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Planned</Text>
            <TextInput style={styles.textInput} value={plannedTime} onChangeText={setPlannedTime} placeholder="HH:MM" placeholderTextColor={Colors.light.textMuted} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Actual</Text>
            <TextInput style={styles.textInput} value={actualTime} onChangeText={setActualTime} placeholder="HH:MM" placeholderTextColor={Colors.light.textMuted} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Duration (min)</Text>
            <TextInput style={styles.textInput} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
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
            <TextInput style={styles.textInput} value={preLiftMeal} onChangeText={setPreLiftMeal} keyboardType="number-pad" />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Post-session (min after)</Text>
            <TextInput style={styles.textInput} value={postLiftMeal} onChangeText={setPostLiftMeal} keyboardType="number-pad" />
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
        <TextInput style={[styles.textInput, styles.notesInput]} value={notes} onChangeText={setNotes} placeholder="How did this session feel overall?" placeholderTextColor={Colors.light.textMuted} multiline />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.saveBtnText}>Log Session</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.light.text, textAlign: "center" },
  scroll: { paddingHorizontal: 16 },
  existingCard: { backgroundColor: Colors.light.phaseStructuring, borderRadius: 10, padding: 12, marginBottom: 12 },
  existingTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.light.structuring, marginBottom: 4 },
  existingItem: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.text, marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight, paddingBottom: 6 },
  typeRow: { flexDirection: "row", gap: 10 },
  typeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.light.border },
  typeChipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  typeText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.textSecondary },
  typeTextSelected: { color: Colors.light.surface },
  intensityRow: { flexDirection: "row", gap: 8 },
  intensityChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.light.border, alignItems: "center" },
  intensityChipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  intensityText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  intensityTextSelected: { color: Colors.light.surface },
  timeRow: { flexDirection: "row", gap: 8 },
  timeField: { flex: 1 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5, marginTop: 4 },
  textInput: { backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.text },
  notesInput: { height: 80, textAlignVertical: "top", marginTop: 6 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.border, backgroundColor: Colors.light.background },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, alignItems: "center" },
  cancelBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.light.tint, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.surface },
});
