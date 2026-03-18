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
import { NUTRITION_PHASE_MAP } from "@/data/nutritionPhases";
import type { DailyStateSnapshot, NutritionPhaseId } from "@/types";

const ALL_PHASES: NutritionPhaseId[] = [
  "base", "carbup", "carbcut", "fatcut", "recomp", "deload", "dietbreak", "peakbulk",
];

export default function SnapshotScreen() {
  const insets = useSafeAreaInsets();
  const { today, snapshotForDate, upsertSnapshot, state } = useApp();

  const existing = snapshotForDate(today);

  const [sleepHours, setSleepHours] = useState(existing?.sleepHours?.toString() ?? "7");
  const [sleepQuality, setSleepQuality] = useState(existing?.sleepQuality ?? 3);
  const [physicalEnergy, setPhysicalEnergy] = useState(existing?.physicalEnergy ?? 3);
  const [motivation, setMotivation] = useState(existing?.motivation ?? 3);
  const [mentalFog, setMentalFog] = useState(existing?.mentalFog ?? 2);
  const [emotionalStability, setEmotionalStability] = useState(existing?.emotionalStability ?? 3);
  const [noveltyHunger, setNoveltyHunger] = useState(existing?.noveltyHunger ?? 3);
  const [structureHunger, setStructureHunger] = useState(existing?.structureHunger ?? 3);
  const [pressureSeek, setPressureSeek] = useState(existing?.pressureSeek ?? 2);
  const [sensoryLoadBaseline, setSensoryLoadBaseline] = useState(existing?.sensoryLoadBaseline ?? 2);
  const [socialLoad, setSocialLoad] = useState(existing?.socialLoad ?? 2);
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
      physicalEnergy,
      motivation,
      mentalFog,
      emotionalStability,
      noveltyHunger,
      structureHunger,
      pressureSeek,
      sensoryLoadBaseline,
      socialLoad,
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
          Scores the engine uses to distinguish a schedule mismatch from a discipline failure. Answer quickly — first instinct is more repeatable than careful reasoning.
        </Text>

        {/* ── Sleep ─────────────────────────────────────────────────────── */}
        <SectionHeader title="Sleep" />
        <Text style={styles.fieldLabel}>Hours slept</Text>
        <TextInput
          style={styles.textInput}
          value={sleepHours}
          onChangeText={setSleepHours}
          keyboardType="decimal-pad"
          placeholder="7.5"
          placeholderTextColor={Colors.light.textMuted}
        />
        <RatingSlider
          label="Sleep quality — my sleep last night was…"
          sublabel="poor · average · restorative"
          value={sleepQuality}
          onChange={setSleepQuality}
        />

        {/* ── Energy & State ────────────────────────────────────────────── */}
        <SectionHeader title="Energy & State" note="How available you are to meet the day." />
        <RatingSlider
          label="Physical energy — my body feels…"
          sublabel="drained · average · energized"
          value={physicalEnergy}
          onChange={setPhysicalEnergy}
        />
        <RatingSlider
          label="Motivation — starting things feels…"
          sublabel="resistant · mixed · driven"
          value={motivation}
          onChange={setMotivation}
        />
        <RatingSlider
          label="Mental fog — my thinking feels…"
          sublabel="clear · hazy · very foggy"
          value={mentalFog}
          onChange={setMentalFog}
          inverted
        />
        <RatingSlider
          label="Emotional stability — my emotional state feels…"
          sublabel="fragile · mixed · grounded"
          value={emotionalStability}
          onChange={setEmotionalStability}
        />

        {/* ── Neuro Pull ────────────────────────────────────────────────── */}
        <SectionHeader
          title="Neuro Pull"
          note="Determines whether your day leans toward exploration, structure, or recovery."
        />
        <RatingSlider
          label="Novelty hunger — I want today to feel…"
          sublabel="want sameness · open to some novelty · craving stimulation"
          value={noveltyHunger}
          onChange={setNoveltyHunger}
        />
        <RatingSlider
          label="Structure hunger — I need today to be…"
          sublabel="flexible is fine · some structure helps · need predictability"
          value={structureHunger}
          onChange={setStructureHunger}
        />
        <RatingSlider
          label="Pressure / compression seeking — right now this would feel…"
          sublabel="not needed · somewhat helpful · strongly wanted"
          value={pressureSeek}
          onChange={setPressureSeek}
        />

        {/* ── Sensory ───────────────────────────────────────────────────── */}
        <SectionHeader
          title="Sensory"
          note="How much capacity your nervous system has before the day has asked anything of it."
        />
        <RatingSlider
          label="Sensory load baseline — my system already feels…"
          sublabel="low load · noticeable strain · already overloaded"
          value={sensoryLoadBaseline}
          onChange={setSensoryLoadBaseline}
          inverted
        />
        <RatingSlider
          label="Social load — contact with people feels…"
          sublabel="easy · tiring · strongly costly"
          value={socialLoad}
          onChange={setSocialLoad}
          inverted
        />
        <RatingSlider
          label="Noise aversion — sound and noise feel…"
          sublabel="tolerable · irritating · overwhelming"
          value={noiseAversion}
          onChange={setNoiseAversion}
          inverted
        />
        <RatingSlider
          label="Light aversion — brightness and harsh light feel…"
          sublabel="tolerable · irritating · overwhelming"
          value={lightAversion}
          onChange={setLightAversion}
          inverted
        />
        <RatingSlider
          label="Texture sensitivity — surfaces and body sensations feel…"
          sublabel="tolerable · noticeable · disruptive"
          value={textureSensitivity}
          onChange={setTextureSensitivity}
          inverted
        />

        {/* ── Nutrition Regime ──────────────────────────────────────────── */}
        <SectionHeader title="Nutrition Regime" note="Current phase for today." />
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

// ─── Section header with optional note ───────────────────────────────────────

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
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
  intro: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    backgroundColor: Colors.light.creamMid,
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    lineHeight: 19,
  },
  sectionBlock: {
    marginTop: 22,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    paddingBottom: 7,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  sectionNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textMuted,
    marginTop: 3,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
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
  phaseChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
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
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.surface },
});
