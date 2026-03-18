import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
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
import type { DailyStateSnapshot, NutritionPhaseId } from "@/types";
import { NUTRITION_PHASE_MAP } from "@/data/nutritionPhases";

const ALL_PHASES: NutritionPhaseId[] = [
  "base", "carbup", "carbcut", "fatcut", "recomp", "deload", "dietbreak", "peakbulk",
];

export default function SnapshotScreen() {
  const insets = useSafeAreaInsets();
  const { today, snapshotForDate, upsertSnapshot, state } = useApp();

  const existing = snapshotForDate(today);

  const [sleepHours, setSleepHours] = useState(existing?.sleepHours?.toString() ?? "7");
  const [sleepQuality, setSleepQuality] = useState(existing?.sleepQuality ?? 3);
  const [sensoryLoadBaseline, setSensoryLoadBaseline] = useState(existing?.sensoryLoadBaseline ?? 2);
  const [socialLoad, setSocialLoad] = useState(existing?.socialLoad ?? 2);
  const [motivation, setMotivation] = useState(existing?.motivation ?? 3);
  const [mentalFog, setMentalFog] = useState(existing?.mentalFog ?? 2);
  const [physicalEnergy, setPhysicalEnergy] = useState(existing?.physicalEnergy ?? 3);
  const [emotionalStability, setEmotionalStability] = useState(existing?.emotionalStability ?? 3);
  const [noveltyHunger, setNoveltyHunger] = useState(existing?.noveltyHunger ?? 3);
  const [structureHunger, setStructureHunger] = useState(existing?.structureHunger ?? 3);
  const [pressureSeek, setPressureSeek] = useState(existing?.pressureSeek ?? 2);
  const [noiseAversion, setNoiseAversion] = useState(existing?.noiseAversion ?? 2);
  const [lightAversion, setLightAversion] = useState(existing?.lightAversion ?? 2);
  const [textureSensitivity, setTextureSensitivity] = useState(existing?.textureSensitivity ?? 2);
  const [nutritionPhaseId, setNutritionPhaseId] = useState<NutritionPhaseId>(
    existing?.nutritionPhaseId ?? state.currentNutritionPhaseId
  );

  const handleSave = () => {
    const snapshot: DailyStateSnapshot = {
      date: today,
      sleepHours: parseFloat(sleepHours) || 7,
      sleepQuality,
      sensoryLoadBaseline,
      socialLoad,
      motivation,
      mentalFog,
      physicalEnergy,
      emotionalStability,
      noveltyHunger,
      structureHunger,
      pressureSeek,
      noiseAversion,
      lightAversion,
      textureSensitivity,
      nutritionPhaseId,
    };
    upsertSnapshot(snapshot);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.title}>Daily State</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        <Text style={styles.intro}>
          This snapshot drives your recommended day mode and helps the engine distinguish schedule mismatch from discipline failure.
        </Text>

        <Text style={styles.sectionTitle}>Sleep</Text>
        <Text style={styles.fieldLabel}>Hours slept</Text>
        <TextInput
          style={styles.textInput}
          value={sleepHours}
          onChangeText={setSleepHours}
          keyboardType="decimal-pad"
          placeholder="7.5"
          placeholderTextColor={Colors.light.textMuted}
        />
        <RatingSlider label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />

        <Text style={styles.sectionTitle}>Energy & State</Text>
        <RatingSlider label="Physical energy" value={physicalEnergy} onChange={setPhysicalEnergy} />
        <RatingSlider label="Motivation" value={motivation} onChange={setMotivation} />
        <RatingSlider label="Mental fog" value={mentalFog} onChange={setMentalFog} inverted />
        <RatingSlider label="Emotional stability" value={emotionalStability} onChange={setEmotionalStability} />

        <Text style={styles.sectionTitle}>Neuro Pull</Text>
        <Text style={styles.pullNote}>These determine whether your day leans toward exploration, structure, or recovery.</Text>
        <RatingSlider label="Novelty hunger (ADHD pull)" value={noveltyHunger} onChange={setNoveltyHunger} />
        <RatingSlider label="Structure hunger (Autism pull)" value={structureHunger} onChange={setStructureHunger} />
        <RatingSlider label="Pressure/compression seeking" value={pressureSeek} onChange={setPressureSeek} />

        <Text style={styles.sectionTitle}>Sensory</Text>
        <RatingSlider label="Sensory load baseline" value={sensoryLoadBaseline} onChange={setSensoryLoadBaseline} inverted />
        <RatingSlider label="Social load" value={socialLoad} onChange={setSocialLoad} inverted />
        <RatingSlider label="Noise aversion" value={noiseAversion} onChange={setNoiseAversion} inverted />
        <RatingSlider label="Light aversion" value={lightAversion} onChange={setLightAversion} inverted />
        <RatingSlider label="Texture sensitivity" value={textureSensitivity} onChange={setTextureSensitivity} inverted />

        <Text style={styles.sectionTitle}>Nutrition Regime</Text>
        <Text style={styles.fieldLabel}>Current phase for today</Text>
        <View style={styles.phaseGrid}>
          {ALL_PHASES.map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNutritionPhaseId(p);
              }}
              style={[styles.phaseChip, p === nutritionPhaseId && styles.phaseChipSelected]}
            >
              <Text style={[styles.phaseChipText, p === nutritionPhaseId && styles.phaseChipTextSelected]}>
                {NUTRITION_PHASE_MAP[p]?.phaseName ?? p}
              </Text>
            </Pressable>
          ))}
        </View>
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
          <Text style={styles.saveBtnText}>Save State</Text>
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
  intro: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    backgroundColor: Colors.light.creamMid,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    lineHeight: 19,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginTop: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    paddingBottom: 6,
  },
  pullNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textMuted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  textInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 12,
  },
  phaseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  phaseChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  phaseChipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  phaseChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  phaseChipTextSelected: { color: Colors.light.surface },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, alignItems: "center" },
  cancelBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.light.tint, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.surface },
});
