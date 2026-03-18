import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhaseTag } from "@/components/ui/PhaseTag";
import { RatingSlider } from "@/components/ui/RatingSlider";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { BlockRatings, BlockStatus, ScheduleBlock, SensoryNotes } from "@/types";

const STATUS_OPTIONS: { value: BlockStatus; label: string; color: string }[] = [
  { value: "planned", label: "Planned", color: Colors.light.textMuted },
  { value: "done", label: "Done", color: Colors.light.structuring },
  { value: "partial", label: "Partial", color: Colors.light.amber },
  { value: "skipped", label: "Skipped", color: Colors.light.rose },
  { value: "moved", label: "Moved", color: Colors.light.amber },
];

type TabId = "actuals" | "ratings" | "sensory";

export default function BlockDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, updateBlock, removeBlock } = useApp();

  const block = useMemo(() => state.blocks.find((b) => b.id === id), [state.blocks, id]);

  const [tab, setTab] = useState<TabId>("actuals");
  const [status, setStatus] = useState<BlockStatus>(block?.status ?? "planned");
  const [actualStart, setActualStart] = useState(block?.actualStart ?? "");
  const [actualEnd, setActualEnd] = useState(block?.actualEnd ?? "");
  const [ratings, setRatings] = useState<Partial<BlockRatings>>(block?.ratings ?? {});
  const [sensory, setSensory] = useState<Partial<SensoryNotes>>(block?.sensoryNotes ?? {});
  const [notes, setNotes] = useState(block?.notes ?? "");

  if (!block) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.errorText}>Block not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleSave = () => {
    const updates: Partial<ScheduleBlock> = {
      status,
      actualStart: actualStart.trim() || undefined,
      actualEnd: actualEnd.trim() || undefined,
      ratings: Object.keys(ratings).length > 0 ? ratings : undefined,
      sensoryNotes: Object.keys(sensory).length > 0 ? sensory : undefined,
      notes: notes.trim() || undefined,
    };
    updateBlock(block.id, updates);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert("Remove Block", `Remove "${block.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removeBlock(block.id);
          router.back();
        },
      },
    ]);
  };

  const updateRating = (key: keyof BlockRatings, value: number) => {
    setRatings((r) => ({ ...r, [key]: value }));
  };

  const toggleSensory = (key: keyof SensoryNotes) => {
    setSensory((s) => ({ ...s, [key]: !s[key] }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{block.label}</Text>
        <Pressable onPress={handleDelete} style={styles.deleteBtn}>
          <Feather name="trash-2" size={18} color={Colors.light.rose} />
        </Pressable>
      </View>

      <View style={styles.blockMeta}>
        <Text style={styles.metaTime}>{block.plannedStart} – {block.plannedEnd}</Text>
        <PhaseTag phase={block.phaseTag} small />
        <Text style={styles.metaType}>{block.blockType}</Text>
      </View>

      {/* Status row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow} contentContainerStyle={styles.statusRowContent}>
        {STATUS_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setStatus(opt.value);
            }}
            style={[styles.statusChip, status === opt.value && { backgroundColor: opt.color + "22", borderColor: opt.color }]}
          >
            <Text style={[styles.statusChipText, status === opt.value && { color: opt.color }]}>{opt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["actuals", "ratings", "sensory"] as TabId[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTab(t);
            }}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {tab === "actuals" && (
          <View style={styles.section}>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>Actual Start</Text>
                <TextInput
                  style={styles.textInput}
                  value={actualStart}
                  onChangeText={setActualStart}
                  placeholder={block.plannedStart}
                  placeholderTextColor={Colors.light.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>Actual End</Text>
                <TextInput
                  style={styles.textInput}
                  value={actualEnd}
                  onChangeText={setActualEnd}
                  placeholder={block.plannedEnd}
                  placeholderTextColor={Colors.light.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {block.startDevMin !== undefined && block.actualStart && (
              <View style={styles.deviationCard}>
                <Text style={styles.devTitle}>Deviations</Text>
                <View style={styles.devRow}>
                  <Text style={styles.devKey}>Start deviation</Text>
                  <Text style={[styles.devVal, { color: block.startDevMin !== 0 ? Colors.light.amber : Colors.light.structuring }]}>
                    {block.startDevMin > 0 ? `+${block.startDevMin}m` : block.startDevMin < 0 ? `${block.startDevMin}m` : "on time"}
                  </Text>
                </View>
                <View style={styles.devRow}>
                  <Text style={styles.devKey}>Duration deviation</Text>
                  <Text style={[styles.devVal, { color: block.durationDevMin !== 0 ? Colors.light.amber : Colors.light.structuring }]}>
                    {block.durationDevMin !== undefined ? (block.durationDevMin > 0 ? `+${block.durationDevMin}m` : block.durationDevMin < 0 ? `${block.durationDevMin}m` : "exact") : "—"}
                  </Text>
                </View>
                <View style={styles.devRow}>
                  <Text style={styles.devKey}>Adherence score</Text>
                  <Text style={[styles.devVal, { color: (block.adherenceScore ?? 0) >= 70 ? Colors.light.structuring : Colors.light.amber }]}>
                    {block.adherenceScore ?? "—"}%
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did this block actually go?"
              placeholderTextColor={Colors.light.textMuted}
              multiline
            />
          </View>
        )}

        {tab === "ratings" && (
          <View style={styles.section}>
            <Text style={styles.ratingNote}>
              Rate how this block felt. 1 = low, 5 = high.{"\n"}
              High resistance or overload with on-time execution may indicate a state mismatch, not a discipline failure.
            </Text>
            <RatingSlider label="Ease of starting" value={ratings.ease ?? 0} onChange={(v) => updateRating("ease", v)} />
            <RatingSlider label="Resistance felt" value={ratings.resistance ?? 0} onChange={(v) => updateRating("resistance", v)} inverted />
            <RatingSlider label="Mental overload" value={ratings.overload ?? 0} onChange={(v) => updateRating("overload", v)} inverted />
            <RatingSlider label="Focus quality" value={ratings.focus ?? 0} onChange={(v) => updateRating("focus", v)} />
            <RatingSlider label="Satisfaction" value={ratings.satisfaction ?? 0} onChange={(v) => updateRating("satisfaction", v)} />
            <RatingSlider label="Transition difficulty" value={ratings.transitionDifficulty ?? 0} onChange={(v) => updateRating("transitionDifficulty", v)} inverted />
            <Text style={styles.fieldLabelSection}>Placement Fit</Text>
            <RatingSlider label="Felt too early" value={ratings.feltTooEarly ?? 0} onChange={(v) => updateRating("feltTooEarly", v)} inverted />
            <RatingSlider label="Felt too late" value={ratings.feltTooLate ?? 0} onChange={(v) => updateRating("feltTooLate", v)} inverted />
            <RatingSlider label="Felt too long" value={ratings.feltTooLong ?? 0} onChange={(v) => updateRating("feltTooLong", v)} inverted />
            <RatingSlider label="Felt too short" value={ratings.feltTooShort ?? 0} onChange={(v) => updateRating("feltTooShort", v)} inverted />
          </View>
        )}

        {tab === "sensory" && (
          <View style={styles.section}>
            <Text style={styles.ratingNote}>
              Log sensory conditions during this block. These become pattern data over time.
            </Text>
            {(
              [
                { key: "noise", label: "Noise was a factor" },
                { key: "light", label: "Light was uncomfortable" },
                { key: "textureDiscomfort", label: "Texture/clothing discomfort" },
                { key: "crowding", label: "Crowding present" },
                { key: "pressureHelped", label: "Pressure/compression helped" },
                { key: "headphonesUsed", label: "Headphones used" },
              ] as { key: keyof SensoryNotes; label: string }[]
            ).map(({ key, label }) => (
              <View key={key} style={styles.sensoryRow}>
                <Text style={styles.sensoryLabel}>{label}</Text>
                <Switch
                  value={!!sensory[key]}
                  onValueChange={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleSensory(key);
                  }}
                  trackColor={{ false: Colors.light.creamDark, true: Colors.light.sageLight }}
                  thumbColor={sensory[key] ? Colors.light.sage : Colors.light.surface}
                />
              </View>
            ))}
            <Text style={styles.fieldLabel}>Sensory notes</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={sensory.notes ?? ""}
              onChangeText={(t) => setSensory((s) => ({ ...s, notes: t }))}
              placeholder="What specifically was difficult or helpful?"
              placeholderTextColor={Colors.light.textMuted}
              multiline
            />
          </View>
        )}
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
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text, letterSpacing: -0.3 },
  deleteBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  blockMeta: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  metaTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted },
  metaType: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted, textTransform: "capitalize" },
  statusRow: { flexGrow: 0, marginBottom: 8 },
  statusRowContent: { paddingHorizontal: 16, gap: 6 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statusChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textMuted },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: Colors.light.creamMid,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: Colors.light.surface },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textMuted },
  tabTextActive: { fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  scroll: { paddingHorizontal: 16 },
  section: {},
  timeRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  timeField: { flex: 1 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  fieldLabelSection: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text, marginTop: 16, marginBottom: 10 },
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
  },
  notesInput: { height: 80, textAlignVertical: "top" },
  deviationCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  devTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  devRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  devKey: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  devVal: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  ratingNote: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18, backgroundColor: Colors.light.creamMid, borderRadius: 8, padding: 10, marginBottom: 12 },
  sensoryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  sensoryLabel: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.text },
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
  errorText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.light.rose, textAlign: "center", padding: 20 },
  backBtn: { padding: 12, alignSelf: "center" },
  backBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.accent },
});
