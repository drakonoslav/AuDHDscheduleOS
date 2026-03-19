import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { QuantitativeDailyLog } from "@/types";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 7);
}

function hhmToMins(h: string, m: string): number | undefined {
  const hNum = parseInt(h);
  const mNum = parseInt(m);
  if (h === "" && m === "") return undefined;
  return (isNaN(hNum) ? 0 : hNum) * 60 + (isNaN(mNum) ? 0 : mNum);
}

// ─── Waist picker data ────────────────────────────────────────────────────────
const WAIST_MIN = 25.0;
const WAIST_STEP = 0.25;
const WAIST_VALUES: number[] = [];
for (let v = WAIST_MIN; v <= 60.001; v += WAIST_STEP) {
  WAIST_VALUES.push(Math.round(v * 100) / 100);
}
const ITEM_H = 44;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE;

// ─── HH:MM split entry ────────────────────────────────────────────────────────
interface HMState { h: string; m: string }

function TimeEntry({
  label, value, onChange,
}: { label: string; value: HMState; onChange: (v: HMState) => void }) {
  const mins = hhmToMins(value.h, value.m);
  const hasValue = value.h !== "" || value.m !== "";
  return (
    <View style={te.wrap}>
      <Text style={te.label}>{label}</Text>
      <View style={te.row}>
        <TextInput
          style={te.box}
          value={value.h}
          onChangeText={(t) => onChange({ ...value, h: t.replace(/\D/g, "").slice(0, 2) })}
          placeholder="hh"
          placeholderTextColor={Colors.light.textMuted}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={te.sep}>:</Text>
        <TextInput
          style={te.box}
          value={value.m}
          onChangeText={(t) => onChange({ ...value, m: t.replace(/\D/g, "").slice(0, 2) })}
          placeholder="mm"
          placeholderTextColor={Colors.light.textMuted}
          keyboardType="number-pad"
          maxLength={2}
        />
        {hasValue && mins !== undefined && (
          <Text style={te.mins}>{mins} min</Text>
        )}
      </View>
    </View>
  );
}

const te = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: {
    width: 62,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
  },
  sep: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.light.textMuted },
  mins: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.accent, marginLeft: 6 },
});

// ─── Number field ─────────────────────────────────────────────────────────────
function NumberField({
  label, value, onChange, placeholder, decimal = false, unit,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; decimal?: boolean; unit?: string;
}) {
  return (
    <View style={nf.wrap}>
      <Text style={nf.label}>{label}</Text>
      <View style={nf.row}>
        <TextInput
          style={nf.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.light.textMuted}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
        />
        {unit ? <Text style={nf.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const nf = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.light.text,
  },
  unit: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.textMuted, minWidth: 36 },
});

// ─── Waist drum picker ────────────────────────────────────────────────────────
function WaistPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const listRef = useRef<FlatList>(null);
  const selectedIndex = useMemo(
    () => Math.round((value - WAIST_MIN) / WAIST_STEP),
    [value]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: selectedIndex * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const onScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, WAIST_VALUES.length - 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(WAIST_VALUES[clamped]!);
  }, [onChange]);

  return (
    <View style={wp.container}>
      <View style={[wp.highlight, { pointerEvents: "none" }]} />
      <FlatList
        ref={listRef}
        data={WAIST_VALUES}
        keyExtractor={(_, i) => i.toString()}
        getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item, index }) => {
          const isSel = index === selectedIndex;
          return (
            <View style={[wp.item, isSel && wp.itemSel]}>
              <Text style={[wp.text, isSel && wp.textSel]}>{item.toFixed(2)}"</Text>
            </View>
          );
        }}
        style={{ height: PICKER_H }}
      />
    </View>
  );
}

const wp = StyleSheet.create({
  container: {
    borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface, overflow: "hidden",
    height: PICKER_H, position: "relative",
  },
  highlight: {
    position: "absolute", left: 0, right: 0,
    top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H,
    backgroundColor: Colors.light.creamMid,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.light.border,
    zIndex: 1,
  },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemSel: {},
  text: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.light.textMuted },
  textSel: { fontFamily: "Inter_700Bold", fontSize: 19, color: Colors.light.text },
});

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{
      fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.light.textMuted,
      textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12,
    }}>
      {title}
    </Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function QuantitativeLogScreen() {
  const insets = useSafeAreaInsets();
  const { today, upsertQuantitativeLog, quantitativeLogForDate } = useApp();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? today;
  const existing = quantitativeLogForDate(date);

  const [awake, setAwake] = useState<HMState>({ h: "", m: "" });
  const [rem, setRem] = useState<HMState>({ h: "", m: "" });
  const [core, setCore] = useState<HMState>({ h: "", m: "" });
  const [deep, setDeep] = useState<HMState>({ h: "", m: "" });
  const [hrv, setHrv] = useState(existing?.hrv?.toString() ?? "");
  const [rhr, setRhr] = useState(existing?.rhr?.toString() ?? "");
  const [weight, setWeight] = useState(existing?.weightLbs?.toString() ?? "");
  const [bodyFat, setBodyFat] = useState(existing?.bodyFatPct?.toString() ?? "");
  const [skelMuscle, setSkelMuscle] = useState(existing?.skeletalMusclePct?.toString() ?? "");
  const [fatFree, setFatFree] = useState(existing?.fatFreeMassLbs?.toString() ?? "");
  const [waist, setWaist] = useState(existing?.waistIn ?? 30.0);
  const [hormDur, setHormDur] = useState<HMState>({ h: "", m: "" });
  const [hormQuant, setHormQuant] = useState(existing?.hormoneQuantCount?.toString() ?? "");
  const [hormQual, setHormQual] = useState(existing?.hormoneQualCount?.toString() ?? "");

  useEffect(() => {
    if (!existing) return;
    const minsToHM = (mins: number): HMState => ({
      h: Math.floor(mins / 60).toString(),
      m: (mins % 60).toString(),
    });
    if (existing.awakeMin !== undefined) setAwake(minsToHM(existing.awakeMin));
    if (existing.remMin !== undefined) setRem(minsToHM(existing.remMin));
    if (existing.coreMin !== undefined) setCore(minsToHM(existing.coreMin));
    if (existing.deepMin !== undefined) setDeep(minsToHM(existing.deepMin));
    if (existing.hormoneDurationMin !== undefined) setHormDur(minsToHM(existing.hormoneDurationMin));
  }, []);

  const handleSave = () => {
    const log: QuantitativeDailyLog = {
      id: existing?.id ?? generateId(),
      date,
      awakeMin: hhmToMins(awake.h, awake.m),
      remMin: hhmToMins(rem.h, rem.m),
      coreMin: hhmToMins(core.h, core.m),
      deepMin: hhmToMins(deep.h, deep.m),
      hrv: hrv ? parseInt(hrv) : undefined,
      rhr: rhr ? parseInt(rhr) : undefined,
      weightLbs: weight ? parseFloat(weight) : undefined,
      bodyFatPct: bodyFat ? parseFloat(bodyFat) : undefined,
      skeletalMusclePct: skelMuscle ? parseFloat(skelMuscle) : undefined,
      fatFreeMassLbs: fatFree ? parseFloat(fatFree) : undefined,
      waistIn: waist,
      hormoneDurationMin: hhmToMins(hormDur.h, hormDur.m),
      hormoneQuantCount: hormQuant ? parseFloat(hormQuant) : undefined,
      hormoneQualCount: hormQual ? parseFloat(hormQual) : undefined,
    };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    upsertQuantitativeLog(log);
    router.back();
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <View style={[s.container, { paddingTop: topInset }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Quantitative Daily Log</Text>
          <Text style={s.dateLabel}>{dateLabel}</Text>
        </View>
        {existing && (
          <View style={s.updatingBadge}>
            <Text style={s.updatingText}>Updating</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
      >

        {/* Sleep Stages */}
        <View style={s.section}>
          <SectionHeader title="Sleep Stages" />
          <Text style={s.note}>Enter hours and minutes — total shown in mins</Text>
          <TimeEntry label="Awake" value={awake} onChange={setAwake} />
          <TimeEntry label="REM" value={rem} onChange={setRem} />
          <TimeEntry label="Core" value={core} onChange={setCore} />
          <TimeEntry label="Deep" value={deep} onChange={setDeep} />
        </View>

        {/* Vitals */}
        <View style={s.section}>
          <SectionHeader title="Vitals" />
          <NumberField label="HRV" value={hrv} onChange={setHrv} placeholder="52" unit="ms" />
          <NumberField label="Resting Heart Rate" value={rhr} onChange={setRhr} placeholder="58" unit="bpm" />
        </View>

        {/* Body Composition */}
        <View style={s.section}>
          <SectionHeader title="Body Composition" />
          <NumberField label="Weight" value={weight} onChange={setWeight} placeholder="185.5" unit="lbs" decimal />
          <NumberField label="Body Fat" value={bodyFat} onChange={setBodyFat} placeholder="18.2" unit="%" decimal />
          <NumberField label="Skeletal Muscle Mass" value={skelMuscle} onChange={setSkelMuscle} placeholder="44.1" unit="%" decimal />
          <NumberField label="Fat Free Mass" value={fatFree} onChange={setFatFree} placeholder="151.2" unit="lbs" decimal />
        </View>

        {/* Waist */}
        <View style={s.section}>
          <SectionHeader title="Waist Measurement" />
          <Text style={s.note}>Scroll to select · increments of 0.25"</Text>
          <View style={s.waistRow}>
            <View style={{ flex: 1 }}>
              <WaistPicker value={waist} onChange={setWaist} />
            </View>
            <View style={s.waistDisplay}>
              <Text style={s.waistVal}>{waist.toFixed(2)}"</Text>
              <Text style={s.waistUnit}>inches</Text>
            </View>
          </View>
        </View>

        {/* Hormone Signal */}
        <View style={s.section}>
          <SectionHeader title="Hormone Signal" />
          <TimeEntry label="Hormone Duration" value={hormDur} onChange={setHormDur} />
          <NumberField label="Quantitative Count" value={hormQuant} onChange={setHormQuant} placeholder="12.5" decimal />
          <NumberField label="Qualitative Count" value={hormQual} onChange={setHormQual} placeholder="8.0" decimal />
        </View>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.saveBtnText}>
            {existing ? "Update Quantitative Log" : "Save Quantitative Log"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.light.text, letterSpacing: -0.3 },
  dateLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted, marginTop: 1 },
  updatingBadge: {
    backgroundColor: Colors.light.amber + "22", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.light.amber + "55",
  },
  updatingText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.amber },
  scroll: { paddingHorizontal: 16 },
  section: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.light.border,
    padding: 16, marginBottom: 10,
  },
  note: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.light.textMuted, marginBottom: 14, marginTop: -4,
  },
  waistRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  waistDisplay: { alignItems: "center", minWidth: 60 },
  waistVal: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.light.text, letterSpacing: -0.3 },
  waistUnit: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted, marginTop: 2 },
  saveBtn: {
    backgroundColor: Colors.light.tint, borderRadius: 14,
    paddingVertical: 17, alignItems: "center", marginTop: 6, marginBottom: 16,
  },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.surface },
});
