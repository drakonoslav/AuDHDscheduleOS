/**
 * SeedGateway.tsx
 *
 * Shown at startup (after onboarding, before setup wizard) when
 * setupWizardComplete is false. Offers two paths:
 *   • Implant Schedule Seed  — applies the verified 16-block ground-truth
 *                              schedule immediately and marks setup complete.
 *   • Set Up with Wizard     — opens the full setup wizard flow.
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { SetupWizard } from "@/components/SetupWizard";

export function SeedGateway() {
  const insets = useSafeAreaInsets();
  const { isLoaded, state, importScheduleSeed } = useApp();
  const [showWizard, setShowWizard] = useState(false);

  if (!isLoaded || !state.onboardingComplete || state.setupWizardComplete) {
    return null;
  }

  if (showWizard) {
    return <SetupWizard forceVisible />;
  }

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>

        <View style={styles.header}>
          <Text style={styles.label}>SCHEDULE OS</Text>
          <Text style={styles.title}>Import your schedule</Text>
          <Text style={styles.subtitle}>
            Choose how to seed your daily template library.
          </Text>
        </View>

        <View style={styles.cards}>
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardPrimary, pressed && { opacity: 0.88 }]}
            onPress={importScheduleSeed}
          >
            <View style={styles.cardIcon}>
              <Feather name="download" size={22} color={Colors.light.surface} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Implant Schedule Seed</Text>
              <Text style={styles.cardDesc}>
                Load your verified 16-block ground-truth schedule instantly.
                Add hygiene and micro-blocks manually after.
              </Text>
              <View style={styles.blockList}>
                {[
                  "Wake  05:25",
                  "Cardio  05:50",
                  "Work  07:00 – 16:40",
                  "Lift  17:00 – 18:15",
                  "7 optimised meal anchors",
                ].map((item) => (
                  <View key={item} style={styles.blockRow}>
                    <View style={styles.dot} />
                    <Text style={styles.blockItem}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, styles.cardSecondary, pressed && { opacity: 0.88 }]}
            onPress={() => setShowWizard(true)}
          >
            <View style={[styles.cardIcon, styles.cardIconSecondary]}>
              <Feather name="sliders" size={22} color={Colors.light.text} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, styles.cardTitleSecondary]}>Set Up with Wizard</Text>
              <Text style={[styles.cardDesc, styles.cardDescSecondary]}>
                Configure wake/bed, workouts, work hours, commute and micro-blocks
                step by step.
              </Text>
            </View>
          </Pressable>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  header: {
    gap: 8,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.light.textMuted,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.light.text,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    marginTop: 4,
  },
  cards: {
    gap: 16,
    flex: 1,
    marginTop: 40,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    gap: 16,
  },
  cardPrimary: {
    backgroundColor: Colors.light.text,
  },
  cardSecondary: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  cardIconSecondary: {
    backgroundColor: Colors.light.creamMid,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.light.surface,
  },
  cardTitleSecondary: {
    color: Colors.light.text,
  },
  cardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 19,
  },
  cardDescSecondary: {
    color: Colors.light.textSecondary,
  },
  blockList: {
    marginTop: 10,
    gap: 5,
  },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  blockItem: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
  },
});
