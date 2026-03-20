import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { computeNutritionAdherence } from "@/engine/nutritionAdherence";
import {
  inferOrbitalPhase,
  ORBITAL_COLORS,
  ORBITAL_LABELS,
  ORBITAL_SHORT_DESC,
} from "@/engine/orbitalInference";
import type { OrbitalInference } from "@/engine/orbitalInference";
import {
  buildDailyIndices,
  buildTrendSignals,
  detectInterpretations,
} from "@/engine/trendEngine";
import type {
  CrossLayerInterpretation,
  TrendSignal,
} from "@/engine/trendEngine";
import type { NutritionPhaseId, ScheduleBlock, WeeklyRecommendation } from "@/types";

// ─── Signal color map ─────────────────────────────────────────────────────────
const SIGNAL_COLORS: Record<string, string> = {
  recoveryNeedScore: Colors.light.rose,
  adhdPullScore:     Colors.light.amber,
  autismPullScore:   Colors.light.structuring,
  hrv:               Colors.light.structuring,
  rhr:               Colors.light.rose,
  deepSleepMin:      Colors.light.accent,
};

function deltaColor(delta: number, higherIsWorse: boolean): string {
  if (Math.abs(delta) < 0.1) return Colors.light.textMuted;
  const improving = higherIsWorse ? delta < 0 : delta > 0;
  return improving ? Colors.light.structuring : Colors.light.rose;
}

function deltaLabel(delta: number, unit: string): string {
  const sign = delta > 0 ? "+" : "";
  const rounded = Math.abs(delta) < 10
    ? (Math.round(delta * 10) / 10).toFixed(1)
    : Math.round(delta).toString();
  return `${sign}${rounded}${unit}`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
const SPARK_H = 36;
const MS_DAY = 86_400_000;

function Sparkline({
  signal,
  width,
}: {
  signal: TrendSignal;
  width: number;
}) {
  const pts = signal.points;
  if (pts.length < 2 || width < 4) return null;

  const color = SIGNAL_COLORS[signal.key] ?? Colors.light.accent;
  const values = pts.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = maxV - minV || 1;

  const minT = new Date(pts[0]!.date).getTime();
  const maxT = new Date(pts[pts.length - 1]!.date).getTime();
  const rangeT = maxT - minT || 1;

  const PAD = 4;
  const toX = (date: string) =>
    PAD + ((new Date(date).getTime() - minT) / rangeT) * (width - PAD * 2);
  const toY = (val: number) =>
    PAD + ((maxV - val) / rangeV) * (SPARK_H - PAD * 2);

  // Build path with gap detection
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i]!;
    const x = toX(pt.date);
    const y = toY(pt.value);
    if (i === 0) {
      d += `M${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      const gap =
        new Date(pt.date).getTime() - new Date(pts[i - 1]!.date).getTime();
      if (gap > MS_DAY * 1.5) {
        d += ` M${x.toFixed(1)},${y.toFixed(1)}`;
      } else {
        d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      }
    }
  }

  const lastPt = pts[pts.length - 1]!;
  const lx = toX(lastPt.date);
  const ly = toY(lastPt.value);

  return (
    <Svg width={width} height={SPARK_H}>
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.8}
      />
      <Circle cx={lx} cy={ly} r={3} fill={color} />
    </Svg>
  );
}

// ─── Signal card ──────────────────────────────────────────────────────────────
function SignalCard({ signal }: { signal: TrendSignal }) {
  const [cardW, setCardW] = useState(0);
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setCardW(e.nativeEvent.layout.width - 24),
    []
  );
  const color = SIGNAL_COLORS[signal.key] ?? Colors.light.accent;
  const hasData = signal.points.length > 0;
  const dColor =
    signal.delta !== undefined
      ? deltaColor(signal.delta, signal.higherIsWorse)
      : Colors.light.textMuted;

  return (
    <View style={sc.card} onLayout={onLayout}>
      <View style={sc.topRow}>
        <Text style={sc.label}>{signal.label}</Text>
        <View
          style={[
            sc.confBadge,
            {
              backgroundColor:
                signal.confidence === "high"
                  ? Colors.light.structuring + "22"
                  : Colors.light.amber + "22",
            },
          ]}
        >
          <Text
            style={[
              sc.confText,
              {
                color:
                  signal.confidence === "high"
                    ? Colors.light.structuring
                    : Colors.light.amber,
              },
            ]}
          >
            {signal.confidence === "high" ? "High" : "Low"}
          </Text>
        </View>
      </View>

      {hasData ? (
        <>
          <View style={sc.valueRow}>
            <Text style={[sc.value, { color }]}>
              {signal.latestValue !== undefined
                ? signal.key === "recoveryNeedScore" ||
                  signal.key === "adhdPullScore" ||
                  signal.key === "autismPullScore"
                  ? (Math.round(signal.latestValue * 10) / 10).toFixed(1)
                  : Math.round(signal.latestValue).toString()
                : "—"}
            </Text>
            <Text style={sc.unit}>{signal.unit}</Text>
            {signal.delta !== undefined &&
              Math.abs(signal.delta) >= 0.1 && (
                <View style={[sc.deltaBadge, { backgroundColor: dColor + "22" }]}>
                  <Text style={[sc.deltaText, { color: dColor }]}>
                    {deltaLabel(signal.delta, signal.unit)}
                  </Text>
                </View>
              )}
          </View>
          <View style={sc.sparkWrap}>
            <Sparkline signal={signal} width={cardW} />
          </View>
          <Text style={sc.pointCount}>
            {signal.points.length} data {signal.points.length === 1 ? "point" : "points"}
          </Text>
        </>
      ) : (
        <View style={sc.emptyWrap}>
          <Text style={sc.emptyText}>No data yet</Text>
        </View>
      )}
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  label: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.textSecondary, flex: 1 },
  confBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  confText: { fontFamily: "Inter_600SemiBold", fontSize: 9 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 4 },
  value: { fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: -0.3 },
  unit: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted },
  deltaBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 2 },
  deltaText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  sparkWrap: { marginTop: 2, marginBottom: 2 },
  pointCount: { fontFamily: "Inter_400Regular", fontSize: 9, color: Colors.light.textMuted, marginTop: 2 },
  emptyWrap: { height: 52, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted },
});

// ─── Nutrition Trend Chart ────────────────────────────────────────────────────
interface NutritionDayPoint {
  date: string;
  kcal: number;     targetKcal: number;
  protein: number;  targetProtein: number;
  carbs: number;    targetCarbs: number;
  fat: number;      targetFat: number;
}

const NCHART_H = 56;

function NutritionTrendChart({
  points,
  label,
  color,
  unit,
  target,
  fmt,
}: {
  points: { date: string; value: number }[];
  label: string;
  color: string;
  unit: string;
  target: number;
  fmt?: (v: number) => string;
}) {
  const [w, setW] = useState(0);
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 28),
    [],
  );

  const display = fmt ?? ((v: number) => Math.round(v).toString());
  const latestPt = points.length > 0 ? points[points.length - 1]! : null;
  const latestVal = latestPt?.value ?? 0;
  const avg = points.length > 0
    ? points.reduce((s, p) => s + p.value, 0) / points.length
    : 0;
  const adherePct = target > 0
    ? Math.min(100, Math.round((latestVal / target) * 100))
    : null;

  // Compute SVG coordinates
  const canDraw = points.length >= 2 && w > 4;
  let sparkPath = "";
  let targetLineY = NCHART_H / 2;
  let dotX = 0;
  let dotY = 0;

  if (canDraw) {
    const values = points.map((p) => p.value);
    const allVals = [...values, target];
    const minV = Math.min(...allVals) * 0.9;
    const maxV = Math.max(...allVals) * 1.08;
    const rangeV = maxV - minV || 1;
    const minT = new Date(points[0]!.date).getTime();
    const maxT = new Date(points[points.length - 1]!.date).getTime();
    const rangeT = maxT - minT || 1;
    const PAD = 4;
    const toX = (d: string) =>
      PAD + ((new Date(d).getTime() - minT) / rangeT) * (w - PAD * 2);
    const toY = (v: number) =>
      PAD + ((maxV - v) / rangeV) * (NCHART_H - PAD * 2);

    targetLineY = toY(target);

    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      const x = toX(pt.date);
      const y = toY(pt.value);
      if (i === 0) {
        sparkPath += `M${x.toFixed(1)},${y.toFixed(1)}`;
      } else {
        const gap =
          new Date(pt.date).getTime() -
          new Date(points[i - 1]!.date).getTime();
        sparkPath +=
          gap > MS_DAY * 1.5
            ? ` M${x.toFixed(1)},${y.toFixed(1)}`
            : ` L${x.toFixed(1)},${y.toFixed(1)}`;
      }
    }

    dotX = toX(latestPt!.date);
    dotY = toY(latestPt!.value);
  }

  return (
    <View style={nt.card} onLayout={onLayout}>
      <View style={nt.topRow}>
        <Text style={nt.label}>{label}</Text>
        {adherePct !== null && (
          <View
            style={[
              nt.badge,
              {
                backgroundColor:
                  adherePct >= 90
                    ? Colors.light.structuring + "22"
                    : Colors.light.amber + "22",
              },
            ]}
          >
            <Text
              style={[
                nt.badgeText,
                {
                  color:
                    adherePct >= 90
                      ? Colors.light.structuring
                      : Colors.light.amber,
                },
              ]}
            >
              {adherePct}% of target
            </Text>
          </View>
        )}
      </View>

      <View style={nt.valueRow}>
        <Text style={[nt.value, { color }]}>
          {latestPt ? display(latestVal) : "—"}
        </Text>
        <Text style={nt.unit}>{unit}</Text>
        {points.length > 1 && (
          <Text style={nt.meta}>  avg {display(avg)}</Text>
        )}
        <Text style={nt.meta}>  / {display(target)}</Text>
      </View>

      {canDraw ? (
        <Svg width={w} height={NCHART_H} style={{ marginTop: 8 }}>
          <Path
            d={`M4,${targetLineY.toFixed(1)} L${(w - 4).toFixed(1)},${targetLineY.toFixed(1)}`}
            fill="none"
            stroke={color}
            strokeWidth={1}
            strokeDasharray="5,4"
            opacity={0.3}
          />
          <Path
            d={sparkPath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={dotX} cy={dotY} r={3.5} fill={color} />
        </Svg>
      ) : (
        <View style={nt.emptyChart}>
          <Text style={nt.emptyChartText}>
            {points.length === 0 ? "No data yet" : "Need 2+ days"}
          </Text>
        </View>
      )}

      <Text style={nt.pointCount}>
        {points.length} {points.length === 1 ? "day" : "days"} of data
      </Text>
    </View>
  );
}

const nt = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  value: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.5 },
  unit: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted },
  meta: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted },
  emptyChart: {
    height: NCHART_H,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  emptyChartText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textMuted,
  },
  pointCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.light.textMuted,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textMuted,
    marginBottom: 10,
    marginTop: -2,
  },
});

// ─── Orbital Pressure Section ─────────────────────────────────────────────────
const NUTRITION_PHASE_LABELS: Record<NutritionPhaseId, string> = {
  base:      "Base",
  carbup:    "Carb-Up",
  carbcut:   "Carb-Cut",
  fatcut:    "Fat-Cut",
  recomp:    "Recomp",
  deload:    "Deload",
  dietbreak: "Diet Break",
  peakbulk:  "Peak Bulk",
};

function OrbitalPressureSection({ inference }: { inference: OrbitalInference }) {
  const topScore = inference.topPhase;
  const conf = inference.confidence;

  const CONF_COLOR: Record<typeof conf, string> = {
    high:     Colors.light.structuring,
    moderate: Colors.light.amber,
    low:      Colors.light.textMuted,
  };

  return (
    <View>
      {/* Section header */}
      <View style={op.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>Orbital Pressure</Text>
          <Text style={op.subtitle}>Physiological state inferred from {inference.dataPoints}d of data</Text>
        </View>
        <View style={[op.confBadge, { backgroundColor: CONF_COLOR[conf] + "22" }]}>
          <Text style={[op.confText, { color: CONF_COLOR[conf] }]}>
            {conf.charAt(0).toUpperCase() + conf.slice(1)} conf.
          </Text>
        </View>
      </View>

      {/* Top phase highlight */}
      <View style={[op.topCard, { borderLeftColor: ORBITAL_COLORS[inference.topPhase] }]}>
        <View style={op.topCardInner}>
          <View>
            <Text style={op.topLabel}>Strongest signal</Text>
            <Text style={[op.topPhase, { color: ORBITAL_COLORS[inference.topPhase] }]}>
              {ORBITAL_LABELS[inference.topPhase]}
            </Text>
            <Text style={op.topDesc}>{ORBITAL_SHORT_DESC[inference.topPhase]}</Text>
          </View>
          <View style={[op.scoreCircle, { borderColor: ORBITAL_COLORS[inference.topPhase] }]}>
            <Text style={[op.scoreValue, { color: ORBITAL_COLORS[inference.topPhase] }]}>
              {Math.round(inference.topScore * 100)}
            </Text>
            <Text style={op.scorePct}>%</Text>
          </View>
        </View>

        {/* Key signals driving the top phase */}
        {inference.likelihoods[0]!.keySignals.length > 0 && (
          <View style={op.keySignalList}>
            {inference.likelihoods[0]!.keySignals.map((s, i) => (
              <View key={i} style={op.keySignalRow}>
                <View style={[op.keySignalDot, { backgroundColor: ORBITAL_COLORS[inference.topPhase] }]} />
                <Text style={op.keySignalText}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* All-phase likelihood bars */}
      <View style={op.barsCard}>
        <Text style={op.barsTitle}>Phase Likelihood Ranking</Text>
        {inference.likelihoods.map((l) => {
          const isRising  = inference.risingPhase  === l.orbitalPhaseId;
          const isFalling = inference.fallingPhase === l.orbitalPhaseId;
          return (
            <View key={l.orbitalPhaseId} style={op.barRow}>
              <View style={op.barLabelWrap}>
                <Text style={[op.barLabel, l.orbitalPhaseId === topScore && { fontFamily: "Inter_600SemiBold" }]}>
                  {l.label}
                </Text>
                {isRising && (
                  <View style={[op.driftPill, { backgroundColor: Colors.light.structuring + "22" }]}>
                    <Text style={[op.driftPillText, { color: Colors.light.structuring }]}>↑</Text>
                  </View>
                )}
                {isFalling && (
                  <View style={[op.driftPill, { backgroundColor: Colors.light.rose + "22" }]}>
                    <Text style={[op.driftPillText, { color: Colors.light.rose }]}>↓</Text>
                  </View>
                )}
              </View>
              <View style={op.barTrack}>
                <View
                  style={[
                    op.barFill,
                    {
                      width: `${Math.round(l.score * 100)}%` as `${number}%`,
                      backgroundColor: ORBITAL_COLORS[l.orbitalPhaseId],
                      opacity: l.orbitalPhaseId === topScore ? 1.0 : 0.45,
                    },
                  ]}
                />
              </View>
              <Text style={[op.barPct, { color: ORBITAL_COLORS[l.orbitalPhaseId] }]}>
                {Math.round(l.score * 100)}%
              </Text>
            </View>
          );
        })}

        {/* Drift legend — only shown when drift data is available */}
        {inference.driftAvailable && (inference.risingPhase || inference.fallingPhase) && (
          <View style={op.driftLegend}>
            {inference.risingPhase && (
              <View style={op.driftLegendRow}>
                <View style={[op.driftPill, { backgroundColor: Colors.light.structuring + "22" }]}>
                  <Text style={[op.driftPillText, { color: Colors.light.structuring }]}>↑</Text>
                </View>
                <Text style={op.driftLegendText}>
                  {ORBITAL_LABELS[inference.risingPhase]} gaining pressure (last 3d vs 7d)
                </Text>
              </View>
            )}
            {inference.fallingPhase && (
              <View style={op.driftLegendRow}>
                <View style={[op.driftPill, { backgroundColor: Colors.light.rose + "22" }]}>
                  <Text style={[op.driftPillText, { color: Colors.light.rose }]}>↓</Text>
                </View>
                <Text style={op.driftLegendText}>
                  {ORBITAL_LABELS[inference.fallingPhase]} losing pressure (last 3d vs 7d)
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Nutrition mismatch card — only shown when mismatch detected */}
      {inference.mismatch && inference.selectedNutritionPhaseId && inference.translatedOrbitalPhaseId && (
        <View style={[
          op.mismatchCard,
          { borderLeftColor: inference.mismatchSeverity === "strong" ? Colors.light.rose : Colors.light.amber }
        ]}>
          <View style={op.mismatchHeader}>
            <Feather
              name={inference.mismatchSeverity === "strong" ? "alert-triangle" : "alert-circle"}
              size={14}
              color={inference.mismatchSeverity === "strong" ? Colors.light.rose : Colors.light.amber}
            />
            <Text style={[
              op.mismatchType,
              { color: inference.mismatchSeverity === "strong" ? Colors.light.rose : Colors.light.amber }
            ]}>
              {inference.mismatchSeverity === "strong" ? "Strong" : "Mild"} Phase Mismatch
            </Text>
          </View>
          <Text style={op.mismatchTitle}>{inference.mismatchTitle}</Text>
          <Text style={op.mismatchDesc}>{inference.mismatchDescription}</Text>

          {/* Comparison: selected → orbital vs observed → suggested */}
          <View style={op.compareRow}>
            <View style={op.compareBlock}>
              <Text style={op.compareLabel}>Selected nutrition</Text>
              <Text style={op.compareValue}>
                {NUTRITION_PHASE_LABELS[inference.selectedNutritionPhaseId]}
              </Text>
              <Text style={op.compareArrow}>↓ translates to</Text>
              <View style={[op.compareTag, { backgroundColor: ORBITAL_COLORS[inference.translatedOrbitalPhaseId] + "22" }]}>
                <Text style={[op.compareTagText, { color: ORBITAL_COLORS[inference.translatedOrbitalPhaseId] }]}>
                  {ORBITAL_LABELS[inference.translatedOrbitalPhaseId]}
                </Text>
              </View>
            </View>
            <View style={op.compareDivider} />
            <View style={op.compareBlock}>
              <Text style={op.compareLabel}>Data suggests</Text>
              <Text style={[op.compareValue, { color: ORBITAL_COLORS[inference.topPhase] }]}>
                {ORBITAL_LABELS[inference.topPhase]}
              </Text>
              {inference.suggestedNutritionPhaseId && (
                <>
                  <Text style={op.compareArrow}>↓ best matched by</Text>
                  <View style={[op.compareTag, { backgroundColor: Colors.light.structuring + "22" }]}>
                    <Text style={[op.compareTagText, { color: Colors.light.structuring }]}>
                      {NUTRITION_PHASE_LABELS[inference.suggestedNutritionPhaseId]}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {inference.suggestionRationale && (
            <Text style={op.rationale}>{inference.suggestionRationale}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const op = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted, marginTop: 2 },
  confBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  confText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },

  // Top card
  topCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
  },
  topCardInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  topLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  topPhase: { fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: -0.3, marginBottom: 3 },
  topDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, maxWidth: "75%" as `${number}%`, lineHeight: 17 },
  scoreCircle: {
    width: 52, height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    alignSelf: "flex-start",
  },
  scoreValue: { fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: -0.5 },
  scorePct: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, marginTop: 5 },
  keySignalList: { marginTop: 10, gap: 5 },
  keySignalRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  keySignalDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  keySignalText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, flex: 1, lineHeight: 17 },

  // Bars card
  barsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 10,
    gap: 9,
  },
  barsTitle: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabelWrap: { flexDirection: "row", alignItems: "center", gap: 4, width: 118 },
  barLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  barTrack: { flex: 1, height: 7, backgroundColor: Colors.light.creamMid, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%" as `${number}%`, borderRadius: 4 },
  barPct: { fontFamily: "Inter_600SemiBold", fontSize: 10, width: 30, textAlign: "right" },
  driftPill: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  driftPillText: { fontFamily: "Inter_700Bold", fontSize: 9 },
  driftLegend: { marginTop: 10, gap: 5, borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 10 },
  driftLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  driftLegendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, flex: 1 },

  // Mismatch card
  mismatchCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
  },
  mismatchHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  mismatchType: { fontFamily: "Inter_600SemiBold", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  mismatchTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text, marginBottom: 7, lineHeight: 18 },
  mismatchDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18, marginBottom: 12 },
  compareRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  compareBlock: { flex: 1 },
  compareDivider: { width: 1, backgroundColor: Colors.light.border, marginVertical: 4 },
  compareLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 },
  compareValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text, marginBottom: 5 },
  compareArrow: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, marginBottom: 5 },
  compareTag: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4, alignSelf: "flex-start" },
  compareTagText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  rationale: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, lineHeight: 17, borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 10 },
});

// ─── Interpretation card ──────────────────────────────────────────────────────
const INTERP_COLORS: Record<CrossLayerInterpretation["type"], string> = {
  alignment: Colors.light.structuring,
  mismatch:  Colors.light.rose,
  drift:     Colors.light.amber,
};

const INTERP_ICONS: Record<CrossLayerInterpretation["type"], string> = {
  alignment: "check-circle",
  mismatch:  "alert-triangle",
  drift:     "trending-down",
};

const INTERP_LABELS: Record<CrossLayerInterpretation["type"], string> = {
  alignment: "Alignment",
  mismatch:  "Mismatch",
  drift:     "Drift",
};

function InterpretationCard({ interp }: { interp: CrossLayerInterpretation }) {
  const color = INTERP_COLORS[interp.type];
  const icon = INTERP_ICONS[interp.type] as never;
  return (
    <View style={[ic.card, { borderLeftColor: color }]}>
      <View style={ic.header}>
        <View style={[ic.iconCircle, { backgroundColor: color + "22" }]}>
          <Feather name={icon} size={13} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ic.typeLabel, { color }]}>{INTERP_LABELS[interp.type]}</Text>
          <Text style={ic.title}>{interp.title}</Text>
        </View>
      </View>
      <Text style={ic.desc}>{interp.description}</Text>
    </View>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 3,
    padding: 12,
  },
  header: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "flex-start" },
  iconCircle: {
    width: 26, height: 26, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  typeLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text, marginTop: 1 },
  desc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18 },
});

// ─── Recommendation card ──────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, string> = {
  timing_shift:      "clock",
  fewer_blocks:      "minus-circle",
  meal_timing:       "coffee",
  training_placement: "zap",
  environment:       "eye-off",
  nutrition_phase:   "layers",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  pattern_backed: Colors.light.structuring,
  emerging:       Colors.light.amber,
  speculative:    Colors.light.textMuted,
};

const CONFIDENCE_LABELS: Record<string, string> = {
  pattern_backed: "Pattern-backed",
  emerging:       "Emerging",
  speculative:    "Exploratory",
};

function RecCard({ rec, onDismiss }: { rec: WeeklyRecommendation; onDismiss: () => void }) {
  if (rec.dismissed) return null;
  const iconName = TYPE_ICONS[rec.type] ?? "info";
  const confColor = CONFIDENCE_COLORS[rec.confidence] ?? Colors.light.textMuted;
  return (
    <View style={styles.recCard}>
      <View style={styles.recCardHeader}>
        <View style={styles.recIconCircle}>
          <Feather name={iconName as never} size={15} color={Colors.light.textSecondary} />
        </View>
        <View style={styles.recHeaderText}>
          <Text style={styles.recTitle}>{rec.title}</Text>
          <View style={[styles.confBadge, { backgroundColor: confColor + "22" }]}>
            <Text style={[styles.confText, { color: confColor }]}>
              {CONFIDENCE_LABELS[rec.confidence]}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDismiss();
          }}
          style={styles.dismissBtn}
        >
          <Feather name="x" size={14} color={Colors.light.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.recBody}>{rec.body}</Text>
      <View style={styles.recActionBox}>
        <Feather name="arrow-right" size={12} color={Colors.light.accent} />
        <Text style={styles.recAction}>{rec.actionable}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Window toggle ─────────────────────────────────────────────────────────────
function WindowToggle({ value, onChange }: { value: 7 | 14; onChange: (v: 7 | 14) => void }) {
  return (
    <View style={wt.pill}>
      {([7, 14] as const).map((w) => (
        <Pressable
          key={w}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(w);
          }}
          style={[wt.seg, value === w && wt.segActive]}
        >
          <Text style={[wt.segText, value === w && wt.segTextActive]}>{w}d</Text>
        </Pressable>
      ))}
    </View>
  );
}

const wt = StyleSheet.create({
  pill: {
    flexDirection: "row",
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  seg: { paddingHorizontal: 10, paddingVertical: 5 },
  segActive: { backgroundColor: Colors.light.tint },
  segText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
  segTextActive: { color: Colors.light.surface },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { state, refreshRecommendations, dismissRecommendation } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [windowDays, setWindowDays] = useState<7 | 14>(14);

  const activeRecs = useMemo(
    () => state.recommendations.filter((r) => !r.dismissed),
    [state.recommendations]
  );

  // 7-day pattern stats (unchanged)
  const recentBlocks = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return state.blocks.filter((b) => new Date(b.date) >= cutoff);
  }, [state.blocks]);

  const recentSnaps = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return state.snapshots.filter((s) => new Date(s.date) >= cutoff);
  }, [state.snapshots]);

  const doneBlocks = recentBlocks.filter((b) => b.status === "done");
  const adherencePct =
    recentBlocks.length > 0
      ? Math.round((doneBlocks.length / recentBlocks.length) * 100)
      : null;

  const avgResistance = useMemo(() => {
    const rated = recentBlocks.filter((b) => b.ratings?.resistance !== undefined);
    if (rated.length === 0) return null;
    return (rated.reduce((s, b) => s + (b.ratings?.resistance ?? 0), 0) / rated.length).toFixed(1);
  }, [recentBlocks]);

  const avgSleep = useMemo(() => {
    if (recentSnaps.length === 0) return null;
    return (recentSnaps.reduce((s, sn) => s + sn.sleepHours, 0) / recentSnaps.length).toFixed(1);
  }, [recentSnaps]);

  const expansionDays   = recentSnaps.filter((s) => s.recommendedDayMode === "expansion_favoring").length;
  const structuringDays = recentSnaps.filter((s) => s.recommendedDayMode === "structuring_favoring").length;
  const recoveryDays    = recentSnaps.filter((s) => s.recommendedDayMode === "recovery_favoring").length;
  const highOverloadBlocks = recentBlocks.filter((b) => (b.ratings?.overload ?? 0) >= 4);

  // ── Trend + orbital inference layer ────────────────────────────────────────
  // Always build a 14d index for orbital inference (needs full window regardless of toggle)
  const dailyIndices14 = useMemo(
    () => buildDailyIndices(state.snapshots, state.quantitativeLogs ?? [], 14),
    [state.snapshots, state.quantitativeLogs]
  );

  const dailyIndices = useMemo(
    () => windowDays === 14 ? dailyIndices14 : buildDailyIndices(state.snapshots, state.quantitativeLogs ?? [], windowDays),
    [state.snapshots, state.quantitativeLogs, windowDays, dailyIndices14]
  );

  const trendSignals = useMemo(() => buildTrendSignals(dailyIndices), [dailyIndices]);

  const interpretations = useMemo(
    () => detectInterpretations(dailyIndices),
    [dailyIndices]
  );

  // Orbital inference always uses 14d window; selected nutrition from most recent snapshot
  const orbitalInference = useMemo(() => {
    const latestSnap = [...state.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
    const selectedNutrition = latestSnap?.nutritionPhaseId ?? null;
    return inferOrbitalPhase(dailyIndices14, selectedNutrition);
  }, [dailyIndices14, state.snapshots]);

  const totalTrendPoints = useMemo(
    () => trendSignals.reduce((sum, s) => sum + s.points.length, 0),
    [trendSignals]
  );

  // ── Per-day nutrition series ────────────────────────────────────────────────
  const nutritionSeries = useMemo((): NutritionDayPoint[] => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);

    // Group meal blocks by date
    const byDate = new Map<string, ScheduleBlock[]>();
    for (const block of state.blocks) {
      if (block.blockType !== "meal") continue;
      if (new Date(block.date) < cutoff) continue;
      const arr = byDate.get(block.date) ?? [];
      arr.push(block);
      byDate.set(block.date, arr);
    }

    const points: NutritionDayPoint[] = [];
    for (const [date, dayBlocks] of byDate.entries()) {
      const snap = state.snapshots.find((s) => s.date === date);
      const phaseId = snap?.nutritionPhaseId ?? state.currentNutritionPhaseId;
      const r = computeNutritionAdherence(dayBlocks, phaseId);
      points.push({
        date,
        kcal: r.actualKcal,       targetKcal: r.targetKcal,
        protein: r.actualProtein, targetProtein: r.targetProtein,
        carbs: r.actualCarbs,     targetCarbs: r.targetCarbs,
        fat: r.actualFat,         targetFat: r.targetFat,
      });
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  }, [state.blocks, state.snapshots, state.currentNutritionPhaseId, windowDays]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            refreshRecommendations();
          }}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="refresh-cw" size={16} color={Colors.light.textSecondary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* ── Last 7 Days stats ─────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label="Block adherence"
            value={adherencePct !== null ? `${adherencePct}%` : "—"}
            sub={`${doneBlocks.length}/${recentBlocks.length} blocks`}
            color={adherencePct !== null && adherencePct >= 70 ? Colors.light.structuring : Colors.light.amber}
          />
          <StatCard
            label="Avg resistance"
            value={avgResistance ?? "—"}
            sub="1–5 scale"
            color={avgResistance && parseFloat(avgResistance) >= 3.5 ? Colors.light.rose : Colors.light.structuring}
          />
          <StatCard
            label="Avg sleep"
            value={avgSleep ? `${avgSleep}h` : "—"}
            sub={`${recentSnaps.length} days logged`}
            color={avgSleep && parseFloat(avgSleep) >= 7 ? Colors.light.structuring : Colors.light.amber}
          />
          <StatCard
            label="High overload"
            value={highOverloadBlocks.length.toString()}
            sub="blocks at 4–5"
            color={highOverloadBlocks.length >= 3 ? Colors.light.rose : Colors.light.textSecondary}
          />
        </View>

        {/* Day mode distribution */}
        {recentSnaps.length > 0 && (
          <View style={styles.modeCard}>
            <Text style={styles.modeCardTitle}>Day Mode Distribution</Text>
            <View style={styles.modeRow}>
              {expansionDays > 0 && (
                <View style={[styles.modeBar, { flex: expansionDays, backgroundColor: Colors.light.phaseExpansion }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.expansion }]}>{expansionDays}d</Text>
                </View>
              )}
              {structuringDays > 0 && (
                <View style={[styles.modeBar, { flex: structuringDays, backgroundColor: Colors.light.phaseStructuring }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.structuring }]}>{structuringDays}d</Text>
                </View>
              )}
              {recoveryDays > 0 && (
                <View style={[styles.modeBar, { flex: recoveryDays, backgroundColor: Colors.light.phaseRecovery }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.recovery }]}>{recoveryDays}d</Text>
                </View>
              )}
              {recentSnaps.length - expansionDays - structuringDays - recoveryDays > 0 && (
                <View style={[styles.modeBar, { flex: recentSnaps.length - expansionDays - structuringDays - recoveryDays, backgroundColor: Colors.light.creamMid }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.textMuted }]}>
                    {recentSnaps.length - expansionDays - structuringDays - recoveryDays}d
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.modeLegend}>
              <View style={styles.modeLegendItem}>
                <View style={[styles.modeDot, { backgroundColor: Colors.light.expansion }]} />
                <Text style={styles.modeLegendText}>Expansion</Text>
              </View>
              <View style={styles.modeLegendItem}>
                <View style={[styles.modeDot, { backgroundColor: Colors.light.structuring }]} />
                <Text style={styles.modeLegendText}>Structuring</Text>
              </View>
              <View style={styles.modeLegendItem}>
                <View style={[styles.modeDot, { backgroundColor: Colors.light.recovery }]} />
                <Text style={styles.modeLegendText}>Recovery</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Orbital Pressure ──────────────────────────────────────────── */}
        {orbitalInference.dataPoints > 0 && (
          <View style={styles.orbitalSection}>
            <OrbitalPressureSection inference={orbitalInference} />
          </View>
        )}

        {/* ── Trends ────────────────────────────────────────────────────── */}
        <View style={styles.trendHeader}>
          <View>
            <Text style={styles.sectionTitle}>Trends</Text>
            <Text style={styles.trendSubtitle}>6 cross-layer signals · sparse-aware</Text>
          </View>
          <WindowToggle value={windowDays} onChange={setWindowDays} />
        </View>

        {totalTrendPoints === 0 ? (
          <View style={styles.trendEmpty}>
            <Feather name="activity" size={28} color={Colors.light.textMuted} />
            <Text style={styles.trendEmptyTitle}>No trend data yet</Text>
            <Text style={styles.trendEmptyBody}>
              Log your qualitative daily state and quantitative measurements for at least 2 days to start seeing trends.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.signalGrid}>
              {trendSignals.map((signal) => (
                <SignalCard key={signal.key} signal={signal} />
              ))}
            </View>

            {/* Cross-layer interpretations */}
            {interpretations.length > 0 && (
              <View style={styles.interpSection}>
                <View style={styles.interpHeader}>
                  <Feather name="layers" size={13} color={Colors.light.textMuted} />
                  <Text style={styles.interpTitle}>Cross-Layer Interpretation</Text>
                </View>
                <Text style={styles.interpNote}>
                  Patterns detected by comparing subjective scores against device data. Two signals agreeing = strong confidence.
                </Text>
                <View style={styles.interpList}>
                  {interpretations.map((interp, i) => (
                    <InterpretationCard key={i} interp={interp} />
                  ))}
                </View>
              </View>
            )}

            {/* Legend */}
            <View style={styles.trendLegend}>
              <View style={styles.trendLegendRow}>
                <View style={[styles.trendLegendDot, { backgroundColor: Colors.light.structuring }]} />
                <Text style={styles.trendLegendText}>High confidence (≥5 points)</Text>
              </View>
              <View style={styles.trendLegendRow}>
                <View style={[styles.trendLegendDot, { backgroundColor: Colors.light.amber }]} />
                <Text style={styles.trendLegendText}>Low confidence (&lt;5 points)</Text>
              </View>
              <View style={styles.trendLegendRow}>
                <View style={styles.trendLegendGap} />
                <Text style={styles.trendLegendText}>Gap in line = missing day</Text>
              </View>
            </View>
          </>
        )}

        {/* ── Nutrition Trends ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Nutrition Trends</Text>
        <Text style={nt.sectionSubtitle}>
          Actual intake vs daily target · {windowDays}d window
        </Text>
        <NutritionTrendChart
          points={nutritionSeries.map((p) => ({ date: p.date, value: p.kcal }))}
          label="Calories"
          color={Colors.light.navyLight}
          unit="kcal"
          target={
            nutritionSeries.length > 0
              ? nutritionSeries[nutritionSeries.length - 1]!.targetKcal
              : 2695
          }
        />
        <NutritionTrendChart
          points={nutritionSeries.map((p) => ({ date: p.date, value: p.protein }))}
          label="Protein"
          color={Colors.light.structuring}
          unit="g"
          target={
            nutritionSeries.length > 0
              ? nutritionSeries[nutritionSeries.length - 1]!.targetProtein
              : 174
          }
          fmt={(v) => (Math.round(v * 10) / 10).toFixed(1)}
        />
        <NutritionTrendChart
          points={nutritionSeries.map((p) => ({ date: p.date, value: p.carbs }))}
          label="Carbohydrates"
          color={Colors.light.amber}
          unit="g"
          target={
            nutritionSeries.length > 0
              ? nutritionSeries[nutritionSeries.length - 1]!.targetCarbs
              : 331
          }
        />
        <NutritionTrendChart
          points={nutritionSeries.map((p) => ({ date: p.date, value: p.fat }))}
          label="Fat"
          color={Colors.light.rose}
          unit="g"
          target={
            nutritionSeries.length > 0
              ? nutritionSeries[nutritionSeries.length - 1]!.targetFat
              : 54
          }
          fmt={(v) => (Math.round(v * 10) / 10).toFixed(1)}
        />

        {/* ── Recommendations ───────────────────────────────────────────── */}
        <View style={styles.recHeader}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {activeRecs.length > 0 && (
            <View style={styles.recCountBadge}>
              <Text style={styles.recCountText}>{activeRecs.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.recNote}>
          <Feather name="info" size={13} color={Colors.light.textMuted} />
          <Text style={styles.recNoteText}>
            Only pattern-backed suggestions appear. Better adherence does not always mean a better schedule — mismatch is detected separately.
          </Text>
        </View>

        {activeRecs.length === 0 ? (
          <View style={styles.emptyRecs}>
            <Feather name="bar-chart-2" size={32} color={Colors.light.textMuted} />
            <Text style={styles.emptyRecsTitle}>No active recommendations</Text>
            <Text style={styles.emptyRecsBody}>Log 3+ days to unlock pattern-based insights.</Text>
          </View>
        ) : (
          <View style={styles.recList}>
            {activeRecs.map((rec) => (
              <RecCard key={rec.id} rec={rec} onDismiss={() => dismissRecommendation(rec.id)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.light.text, letterSpacing: -0.5 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  refreshText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  scroll: { paddingHorizontal: 16 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.text, marginBottom: 4 },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.light.text, marginBottom: 2 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
  statSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, marginTop: 2 },

  // Mode
  modeCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 20,
  },
  modeCardTitle: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  modeRow: { flexDirection: "row", height: 32, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 8 },
  modeBar: { alignItems: "center", justifyContent: "center", borderRadius: 4 },
  modeBarText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  modeLegend: { flexDirection: "row", gap: 12 },
  modeLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeLegendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },

  // Orbital
  orbitalSection: { marginBottom: 20 },

  // Trends
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  trendSubtitle: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted },
  trendEmpty: {
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  trendEmptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.textSecondary },
  trendEmptyBody: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted, textAlign: "center", lineHeight: 18 },
  signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },

  // Interpretations
  interpSection: { marginBottom: 14 },
  interpHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  interpTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.textSecondary },
  interpNote: {
    fontFamily: "Inter_400Regular", fontSize: 11,
    color: Colors.light.textMuted, marginBottom: 8, lineHeight: 16,
  },
  interpList: { gap: 6 },

  // Trend legend
  trendLegend: {
    backgroundColor: Colors.light.creamMid,
    borderRadius: 8,
    padding: 10,
    gap: 5,
    marginBottom: 20,
  },
  trendLegendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trendLegendDot: { width: 8, height: 8, borderRadius: 4 },
  trendLegendGap: {
    width: 8, height: 2,
    borderStyle: "dashed", borderWidth: 1,
    borderColor: Colors.light.textMuted,
  },
  trendLegendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted },

  // Recs
  recHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  recCountBadge: {
    backgroundColor: Colors.light.tint,
    width: 20, height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recCountText: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.light.surface },
  recNote: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: Colors.light.creamMid,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  recNoteText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, flex: 1, lineHeight: 16 },
  recList: { gap: 8 },
  recCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
  },
  recCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  recIconCircle: {
    width: 30, height: 30,
    borderRadius: 8,
    backgroundColor: Colors.light.creamMid,
    alignItems: "center",
    justifyContent: "center",
  },
  recHeaderText: { flex: 1 },
  recTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text, marginBottom: 3 },
  confBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  confText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  dismissBtn: { padding: 4 },
  recBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19, marginBottom: 10 },
  recActionBox: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: Colors.light.phaseStructuring,
    borderRadius: 8,
    padding: 10,
  },
  recAction: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.structuring, flex: 1, lineHeight: 17 },
  emptyRecs: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyRecsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.textSecondary },
  emptyRecsBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textMuted, textAlign: "center" },
});
