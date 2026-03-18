import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { NutritionPhaseId } from "@/types";

const PHASES: { id: NutritionPhaseId; name: string; description: string }[] = [
  { id: "base",      name: "Base",       description: "Balanced maintenance — moderate carbs, moderate fat. Starting point." },
  { id: "carbup",    name: "Carb-Up",    description: "Elevated carbs, lower fat. Used around high-volume training blocks." },
  { id: "carbcut",   name: "Carb-Cut",   description: "Reduced peri-workout carbs, shifted to evening. Fat held steady." },
  { id: "fatcut",    name: "Fat-Cut",    description: "Lower fat across the day. Carbs kept higher to preserve performance." },
  { id: "recomp",    name: "Recomp",     description: "Moderate deficit with carb cycling. Simultaneous lean gain and fat loss." },
  { id: "deload",    name: "Deload",     description: "Reduced overall intake matching lower training volume and intensity." },
  { id: "dietbreak", name: "Diet Break", description: "Maintenance calories to reset leptin and reduce diet fatigue." },
  { id: "peakbulk",  name: "Peak Bulk",  description: "Highest calories and carbs. Aggressive building phase." },
];

const STEPS = ["welcome", "phase", "howto"] as const;
type Step = typeof STEPS[number];

export function Onboarding() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding, isLoaded, state } = useApp();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedPhase, setSelectedPhase] = useState<NutritionPhaseId>("base");

  if (!isLoaded || state.onboardingComplete) return null;

  const stepIndex = STEPS.indexOf(step);

  function handleNext() {
    if (step === "welcome") setStep("phase");
    else if (step === "phase") setStep("howto");
    else completeOnboarding(selectedPhase);
  }

  function handleBack() {
    if (step === "phase") setStep("welcome");
    else if (step === "howto") setStep("phase");
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i <= stepIndex && styles.dotActive]} />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === "welcome" && <WelcomeStep />}
          {step === "phase" && (
            <PhaseStep selected={selectedPhase} onSelect={setSelectedPhase} />
          )}
          {step === "howto" && <HowToStep />}
        </ScrollView>

        {/* Navigation */}
        <View style={[styles.navRow, { paddingBottom: insets.bottom + 16 }]}>
          {step !== "welcome" ? (
            <Pressable style={styles.backBtn} onPress={handleBack}>
              <Feather name="arrow-left" size={18} color={Colors.light.textSecondary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>
              {step === "howto" ? "Start using the app" : "Continue"}
            </Text>
            <Feather
              name={step === "howto" ? "check" : "arrow-right"}
              size={16}
              color="#fff"
            />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function WelcomeStep() {
  return (
    <View style={styles.stepContent}>
      <View style={styles.logoCircle}>
        <Feather name="activity" size={40} color={Colors.light.navyDark} />
      </View>
      <Text style={styles.stepTitle}>AuDHD Schedule OS</Text>
      <Text style={styles.stepSubtitle}>
        A daily operating system built for neurodivergent-aware scheduling.
      </Text>

      <View style={styles.featureList}>
        {[
          { icon: "calendar", label: "Plan", desc: "Build time blocks that match your cognitive capacity, not just your task list." },
          { icon: "edit-3",   label: "Log",  desc: "Track what actually happened — timing, ratings, and sensory conditions." },
          { icon: "bar-chart-2", label: "Insights", desc: "Pattern-backed suggestions that distinguish discipline failure from schedule mismatch." },
          { icon: "coffee",   label: "Meals", desc: "Per-ingredient meal templates tied to your nutrition phase, not averaged estimates." },
        ].map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Feather name={f.icon as never} size={18} color={Colors.light.navyDark} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function PhaseStep({
  selected,
  onSelect,
}: {
  selected: NutritionPhaseId;
  onSelect: (id: NutritionPhaseId) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Current nutrition phase</Text>
      <Text style={styles.stepSubtitle}>
        This sets your active meal templates and guides the orbital interpretation layer. You can change it anytime from the Meals tab.
      </Text>
      <View style={styles.phaseList}>
        {PHASES.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.phaseCard, selected === p.id && styles.phaseCardSelected]}
            onPress={() => onSelect(p.id)}
          >
            <View style={styles.phaseCardRow}>
              <View style={[styles.phaseRadio, selected === p.id && styles.phaseRadioSelected]}>
                {selected === p.id && <View style={styles.phaseRadioDot} />}
              </View>
              <View style={styles.phaseCardText}>
                <Text style={[styles.phaseName, selected === p.id && styles.phaseNameSelected]}>
                  {p.name}
                </Text>
                <Text style={styles.phaseDesc}>{p.description}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function HowToStep() {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>How to use it</Text>
      <Text style={styles.stepSubtitle}>
        The app has five tabs. Here is what each one does.
      </Text>

      <View style={styles.howtoList}>
        {[
          {
            icon: "sun",
            tab: "Today",
            desc: "Your live command center. See today's phase status, day mode (once you log a snapshot), and all planned blocks.",
          },
          {
            icon: "calendar",
            tab: "Plan",
            desc: "Add time blocks to any day. Give each block a label, type, and a schedule tag (expansion / structuring / recovery). Optionally save recurring blocks as templates.",
          },
          {
            icon: "edit-3",
            tab: "Log",
            desc: "Close the loop on past days. Log actual times, rate each block on 10 dimensions, and record sensory conditions.",
          },
          {
            icon: "coffee",
            tab: "Meals",
            desc: "View the full meal template for your active nutrition phase — per-ingredient amounts for each of the 7 daily slots.",
          },
          {
            icon: "bar-chart-2",
            tab: "Insights",
            desc: "Pattern analysis from your logged data. Recommendations only fire after at least 3 data points. No noise, no busy-work.",
          },
        ].map((h) => (
          <View key={h.tab} style={styles.howtoRow}>
            <View style={styles.howtoIcon}>
              <Feather name={h.icon as never} size={16} color={Colors.light.navyDark} />
            </View>
            <View style={styles.howtoText}>
              <Text style={styles.howtoTab}>{h.tab}</Text>
              <Text style={styles.howtoDesc}>{h.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.tipsBox}>
        <Text style={styles.tipsTitle}>Quick start</Text>
        <Text style={styles.tipsBody}>
          Log a daily state snapshot first thing in the morning (Today tab → "Log now"). Then add a few blocks in Plan. Come back to Log at end of day to rate them.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
  dotActive: {
    backgroundColor: Colors.light.navyDark,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  stepContent: {
    gap: 20,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.light.cream,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  stepTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.light.navyDark,
    lineHeight: 32,
  },
  stepSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  featureList: {
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.cream,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  featureText: { flex: 1 },
  featureLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.navyDark,
    marginBottom: 2,
  },
  featureDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  phaseList: { gap: 8 },
  phaseCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    padding: 12,
  },
  phaseCardSelected: {
    borderColor: Colors.light.navyDark,
    backgroundColor: Colors.light.cream,
  },
  phaseCardRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  phaseRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.light.border,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  phaseRadioSelected: {
    borderColor: Colors.light.navyDark,
  },
  phaseRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.navyDark,
  },
  phaseCardText: { flex: 1 },
  phaseName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 2,
  },
  phaseNameSelected: {
    color: Colors.light.navyDark,
  },
  phaseDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  howtoList: { gap: 16 },
  howtoRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  howtoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.cream,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  howtoText: { flex: 1 },
  howtoTab: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.navyDark,
    marginBottom: 3,
  },
  howtoDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  tipsBox: {
    backgroundColor: Colors.light.sage + "22",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.sage,
    padding: 14,
    gap: 6,
  },
  tipsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.navyDark,
  },
  tipsBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.navyDark,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  nextText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
});
