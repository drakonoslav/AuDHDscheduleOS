import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";

const ITEM_H = 48;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2); // 2 spacer rows above and below the selected item

// ─── DialPicker ───────────────────────────────────────────────────────────────

type DialItem = { isVal: true; val: number } | { isVal: false; id: string };

interface DialPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  padded?: boolean;
}

export function DialPicker({ min, max, value, onChange, label, padded = true }: DialPickerProps) {
  const listRef = useRef<FlatList>(null);
  const range = max - min + 1;

  // PAD null spacers + values + PAD null spacers.
  // No contentContainerStyle padding needed — spacer items carry the visual offset.
  // This lets initialScrollIndex work correctly: array index `value-min` puts the
  // target value at the visual center (PAD rows below the top).
  const data = useMemo((): DialItem[] => [
    ...Array.from({ length: PAD }, (_, i): DialItem => ({ isVal: false, id: `s${i}` })),
    ...Array.from({ length: range }, (_, i): DialItem => ({ isVal: true, val: min + i })),
    ...Array.from({ length: PAD }, (_, i): DialItem => ({ isVal: false, id: `e${i}` })),
  ], [min, max, range]);

  // Prevent redundant external-sync scrolls for updates we caused ourselves.
  const committedValue = useRef(value);

  // Scroll the list so `valueIdx` (0-based from min) is centered.
  // Because there are PAD spacer items at the start, valueIdx is the scroll offset
  // in items: data[valueIdx] at the top → data[valueIdx+PAD] at center.
  const scrollToIdx = useCallback((valueIdx: number, animated = false) => {
    listRef.current?.scrollToOffset({ offset: valueIdx * ITEM_H, animated });
  }, []);

  // Sync when the parent changes value (e.g. form reset).
  useEffect(() => {
    if (committedValue.current === value) return;
    committedValue.current = value;
    scrollToIdx(value - min, true);
  }, [value, min, scrollToIdx]);

  // Round a raw scroll-Y to the nearest item, snap the list there, and fire onChange.
  // The programmatic scrollToOffset also cancels any in-flight CSS momentum on web.
  const commitFromY = useCallback((y: number) => {
    const idx = Math.max(0, Math.min(range - 1, Math.round(y / ITEM_H)));
    scrollToIdx(idx, true);
    const newVal = min + idx;
    if (newVal !== committedValue.current) {
      committedValue.current = newVal;
      try { Haptics.selectionAsync(); } catch (_) {}
      onChange(newVal);
    }
  }, [min, range, onChange, scrollToIdx]);

  // Web (Safari): onMomentumScrollEnd is unreliable — commit on finger lift instead.
  const handleScrollEndDrag = useCallback((e: any) => {
    if (Platform.OS === "web") {
      commitFromY(e.nativeEvent.contentOffset.y);
    }
  }, [commitFromY]);

  // Native: fires after snap animation — commit from the exact settled position.
  const handleMomentumScrollEnd = useCallback((e: any) => {
    commitFromY(e.nativeEvent.contentOffset.y);
  }, [commitFromY]);

  return (
    <View style={dialStyles.dial}>
      <Text style={dialStyles.dialLabel}>{label}</Text>
      <View style={dialStyles.drum}>
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item) => item.isVal ? `v${item.val}` : item.id}
          // getItemLayout is required for initialScrollIndex to work.
          getItemLayout={(_, index) => ({ length: ITEM_H, offset: index * ITEM_H, index })}
          // initialScrollIndex puts data[value-min] at the TOP, so data[value-min+PAD]
          // (the actual value) ends up at the visual center.
          initialScrollIndex={value - min}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          // Render all items up front — ranges are small (≤60) so windowing is wasteful.
          initialNumToRender={range + PAD * 2}
          maxToRenderPerBatch={range + PAD * 2}
          windowSize={range + PAD * 2}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item }) => {
            if (!item.isVal) {
              return <View style={dialStyles.item} />;
            }
            const { val } = item;
            const isSelected = val === value;
            return (
              <View style={dialStyles.item}>
                <Text
                  style={[
                    dialStyles.itemText,
                    isSelected && dialStyles.itemTextSelected,
                    Math.abs(val - value) === 1 && dialStyles.itemTextNear,
                  ]}
                >
                  {padded ? val.toString().padStart(2, "0") : val.toString()}
                </Text>
              </View>
            );
          }}
          style={{ height: ITEM_H * VISIBLE }}
        />
        {/* Highlight overlay over the center row — pointerEvents:none passes touches through */}
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
            <DialPicker min={0} max={23} value={sH} label="HR"
              onChange={(h) => onStartChange(toHHMM(h, sM))} />
            <Text style={dialStyles.colon}>:</Text>
            <DialPicker min={0} max={59} value={sM} label="MIN"
              onChange={(m) => onStartChange(toHHMM(sH, m))} />
          </View>
        </View>

        <Text style={dialStyles.arrow}>→</Text>

        {/* ── End ── */}
        <View style={dialStyles.group}>
          <Text style={dialStyles.groupLabel}>END</Text>
          <View style={dialStyles.dialRow}>
            <DialPicker min={0} max={23} value={eH} label="HR"
              onChange={(h) => onEndChange(toHHMM(h, eM))} />
            <Text style={dialStyles.colon}>:</Text>
            <DialPicker min={0} max={59} value={eM} label="MIN"
              onChange={(m) => onEndChange(toHHMM(eH, m))} />
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
  groupRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  group: { alignItems: "center" },
  groupLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.textMuted,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  dialRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  colon: {
    fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.light.text,
    marginBottom: 4, paddingHorizontal: 2,
  },
  arrow: {
    fontFamily: "Inter_400Regular", fontSize: 20, color: Colors.light.textMuted,
    marginTop: 22, paddingHorizontal: 6,
  },
  dial: { alignItems: "center", width: 64 },
  dialLabel: {
    fontFamily: "Inter_500Medium", fontSize: 9, color: Colors.light.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4,
  },
  drum: {
    height: ITEM_H * VISIBLE, width: 64, overflow: "hidden",
    borderRadius: 10, backgroundColor: Colors.light.surface,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: { fontFamily: "Inter_400Regular", fontSize: 18, color: Colors.light.textMuted },
  itemTextNear: { fontFamily: "Inter_500Medium", fontSize: 19, color: Colors.light.textSecondary },
  itemTextSelected: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.light.text },
  highlight: {
    position: "absolute", left: 0, right: 0,
    top: ITEM_H * PAD, height: ITEM_H,
    backgroundColor: Colors.light.tint + "14",
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: Colors.light.tint + "55",
  },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  summaryTime: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  summaryArrow: { color: Colors.light.textMuted, fontFamily: "Inter_400Regular" },
  durationPill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
    backgroundColor: Colors.light.creamMid, borderWidth: 1, borderColor: Colors.light.borderLight,
  },
  durationText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
});
