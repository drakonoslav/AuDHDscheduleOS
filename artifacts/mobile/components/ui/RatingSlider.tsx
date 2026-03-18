import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

interface RatingSliderProps {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (v: number) => void;
  inverted?: boolean;
}

export function RatingSlider({ label, sublabel, value, onChange, inverted = false }: RatingSliderProps) {
  const handlePress = (v: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(v);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      <View style={styles.dots}>
        {[1, 2, 3, 4, 5].map((v) => {
          const isSelected = v === value;
          const isFilled = v <= value;
          const color = inverted
            ? v <= 2
              ? Colors.light.sage
              : v <= 3
              ? Colors.light.amber
              : Colors.light.rose
            : v <= 2
            ? Colors.light.rose
            : v <= 3
            ? Colors.light.amber
            : Colors.light.sage;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => handlePress(v)}
              style={[
                styles.dot,
                isFilled && { backgroundColor: color, borderColor: color },
                isSelected && styles.selectedDot,
              ]}
              accessibilityLabel={`Rate ${v}`}
            >
              <Text style={[styles.dotLabel, isFilled && { color: "#fff" }]}>
                {v}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 3,
  },
  sublabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textMuted,
    marginBottom: 7,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surface,
  },
  selectedDot: {
    transform: [{ scale: 1.08 }],
  },
  dotLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
});
