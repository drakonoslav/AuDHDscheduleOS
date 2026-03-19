import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

const ITEM_H = 48;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

// ─── DialPicker ───────────────────────────────────────────────────────────────

interface DialPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  padded?: boolean;
}

export function DialPicker({ min, max, value, onChange, label, padded = true }: DialPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const range = max - min + 1;
  const items = useMemo(
    () => Array.from({ length: range }, (_, i) => min + i),
    [min, max]
  );

  const didMount = useRef(false);
  // Track last committed value to avoid duplicate onChange calls and
  // to skip external sync scrolls that we ourselves triggered.
  const committedValue = useRef(value);

  const scrollToIdx = useCallback((idx: number, animated = false) => {
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated });
  }, []);

  // Scroll to initial position after layout is ready.
  const handleLayout = useCallback(() => {
    if (didMount.current) return;
    didMount.current = true;
    setTimeout(() => scrollToIdx(value - min, false), 80);
  }, [value, min, scrollToIdx]);

  // If the parent changes value externally (form reset, etc.), sync the scroll.
  useEffect(() => {
    if (!didMount.current) return;
    if (committedValue.current === value) return; // we caused this — skip
    committedValue.current = value;
    scrollToIdx(value - min, true);
  }, [value, min, scrollToIdx]);

  // Core commit: round scroll offset → nearest item → snap + call onChange.
  // The scrollTo(animated:true) call also overrides any in-flight CSS momentum
  // on web, so the drum visually lands on the committed value.
  const commitFromY = useCallback((y: number) => {
    const idx = Math.max(0, Math.min(range - 1, Math.round(y / ITEM_H)));
    const newVal = min + idx;
    // Always snap visually to the grid position (important on web where CSS
    // snap may still be animating when this fires).
    scrollToIdx(idx, true);
    if (newVal !== committedValue.current) {
      committedValue.current = newVal;
      try { Haptics.selectionAsync(); } catch (_) {}
      onChange(newVal);
    }
  }, [min, range, onChange, scrollToIdx]);

  // ── Web: commit on finger lift ──────────────────────────────────────────────
  // onMomentumScrollEnd does NOT fire reliably in iOS Safari (web).
  // onScrollEndDrag fires on touchend — we commit there and immediately
  // programmatically snap the drum, overriding any remaining CSS momentum.
  const handleScrollEndDrag = useCallback((e: any) => {
    if (Platform.OS === "web") {
      commitFromY(e.nativeEvent.contentOffset.y);
    }
  }, [commitFromY]);

  // ── Native: commit after snap settles ───────────────────────────────────────
  // On iOS/Android, snapToInterval guarantees the list lands on an exact
  // ITEM_H multiple; onMomentumScrollEnd fires when the animation finishes.
  const handleMomentumScrollEnd = useCallback((e: any) => {
    commitFromY(e.nativeEvent.contentOffset.y);
  }, [commitFromY]);

  return (
    <View style={dialStyles.dial}>
      <Text style={dialStyles.dialLabel}>{label}</Text>
      <View style={dialStyles.drum}>
        <ScrollView
          ref={scrollRef}
          onLayout={handleLayout}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: ITEM_H * PAD }}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {items.map((v) => (
            <View key={v} style={dialStyles.item}>
              <Text
                style={[
                  dialStyles.itemText,
                  v === value && dialStyles.itemTextSelected,
                  Math.abs(v - value) === 1 && dialStyles.itemTextNear,
                ]}
              >
                {padded ? v.toString().padStart(2, "0") : v.toString()}
              </Text>
            </View>
          ))}
        </ScrollView>
        {/* Highlight overlay — sits on top of scroll content, passes touches through */}
        <View style={[dialStyles.highlight, { pointerEvents: "none" }]} />
      </View>
    </View>
  );
}

// ─── TimeDials ────────────────────────────────────────────────────────────────

interface TimeDialsProps {
  startTime: string;
  endTime: string;
  onStartChange: (t: string) => void;
  onEndChange: (t: string) => void;
}

function parseHHMM(t: string): { h: number; m: number } {
  const parts = t.split(":").map(Number);
  return {
    h: isNaN(parts[0]!) ? 9 : (parts[0]! % 24),
    m: isNaN(parts[1]!) ? 0 : (parts[1]! % 60),
  };
}

function toHHMM(h: number, m: number): string {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function TimeDials({ startTime, endTime, onStartChange, onEndChange }: TimeDialsProps) {
  const { h: sH, m: sM } = parseHHMM(startTime);
  const { h: eH, m: eM } = parseHHMM(endTime);

  const durationMin = useMemo(() => {
    const diff = (eH * 60 + eM) - (sH * 60 + sM);
    return diff > 0 ? diff : null;
  }, [sH, sM, eH, eM]);

  return (
    <View style={dialStyles.container}>
      <View style={dialStyles.groupRow}>
        {/* ── Start ── */}
        <View style={dialStyles.group}>
          <Text style={dialStyles.groupLabel}>START</Text>
          <View style={dialStyles.dialRow}>
            <DialPicker
              min={0} max={23} value={sH} label="HR"
              onChange={(h) => onStartChange(toHHMM(h, sM))}
            />
            <Text style={dialStyles.colon}>:</Text>
            <DialPicker
              min={0} max={59} value={sM} label="MIN"
              onChange={(m) => onStartChange(toHHMM(sH, m))}
            />
          </View>
        </View>

        <Text style={dialStyles.arrow}>→</Text>

        {/* ── End ── */}
        <View style={dialStyles.group}>
          <Text style={dialStyles.groupLabel}>END</Text>
          <View style={dialStyles.dialRow}>
            <DialPicker
              min={0} max={23} value={eH} label="HR"
              onChange={(h) => onEndChange(toHHMM(h, eM))}
            />
            <Text style={dialStyles.colon}>:</Text>
            <DialPicker
              min={0} max={59} value={eM} label="MIN"
              onChange={(m) => onEndChange(toHHMM(eH, m))}
            />
          </View>
        </View>
      </View>

      {/* Summary bar */}
      <View style={dialStyles.summary}>
        <Text style={dialStyles.summaryTime}>
          {startTime}
          <Text style={dialStyles.summaryArrow}> → </Text>
          {endTime}
        </Text>
        {durationMin !== null && (
          <View style={dialStyles.durationPill}>
            <Text style={dialStyles.durationText}>{durationMin} min</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const dialStyles = StyleSheet.create({
  container: { marginTop: 4 },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  group: { alignItems: "center" },
  groupLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  dialRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  colon: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.light.text,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  arrow: {
    fontFamily: "Inter_400Regular",
    fontSize: 20,
    color: Colors.light.textMuted,
    marginTop: 22,
    paddingHorizontal: 6,
  },
  dial: { alignItems: "center", width: 64 },
  dialLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  drum: {
    height: ITEM_H * VISIBLE,
    width: 64,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: {
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    color: Colors.light.textMuted,
  },
  itemTextNear: {
    fontFamily: "Inter_500Medium",
    fontSize: 19,
    color: Colors.light.textSecondary,
  },
  itemTextSelected: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.light.text,
  },
  highlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ITEM_H * PAD,
    height: ITEM_H,
    backgroundColor: Colors.light.tint + "14",
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.light.tint + "55",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  summaryTime: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.text,
  },
  summaryArrow: { color: Colors.light.textMuted, fontFamily: "Inter_400Regular" },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: Colors.light.creamMid,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  durationText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});
