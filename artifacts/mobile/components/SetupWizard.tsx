/**
 * SetupWizard.tsx
 *
 * 9-step schedule seeding wizard. Shown once after onboarding.
 * On completion calls completeSetupWizard(config, buildSchedule(config)).
 * Can be re-run from settings (call state.setupWizardComplete = false externally).
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
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
import { buildSchedule, fromMins } from "@/engine/scheduleBuilder";
import type { BlockType, ScheduleWizardConfig } from "@/types";

// ─── Step keys ────────────────────────────────────────────────────────────────

const STEPS = [
  "welcome",
  "wake_bed",
  "meals",
  "workouts",
  "work",
  "commute",
  "hygiene",
  "micro_wd",
  "micro_we",
  "generate",
] as const;
type Step = (typeof STEPS)[number];

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ScheduleWizardConfig = {
  wakeTime: "06:00",
  bedTime: "22:00",
  mealCount: 3,
  hasCardio: false,
  cardioPre: false,
  cardioPost: false,
  cardioMins: 45,
  cardioTime: "morning",
  hasLift: false,
  liftPre: false,
  liftPost: false,
  liftMins: 60,
  liftTime: "afternoon",
  hasWork: false,
  workDays: [1, 2, 3, 4, 5],
  workStart: "09:00",
  workEnd: "17:00",
  hasCommute: false,
  commuteMinutes: 20,
  showerCount: 1,
  weekdayMicroSize: 15,
  weekdayMicroTypes: [],
  weekendMicroSize: 25,
  weekendMicroTypes: [],
};

const MICRO_SIZES: Array<3 | 5 | 10 | 15 | 25 | 30> = [3, 5, 10, 15, 25, 30];
const MICRO_TYPE_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: "hobby",   label: "Hobby",   icon: "heart" },
  { type: "hygiene", label: "Hygiene", icon: "droplet" },
  { type: "chores",  label: "Chores",  icon: "home" },
  { type: "errands", label: "Errands", icon: "shopping-bag" },
  { type: "rest",    label: "Rest",    icon: "moon" },
];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// ─── Small reusable primitives ────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={prim.row}>
      <Text style={prim.rowLabel}>{label}</Text>
      <View style={prim.rowRight}>{children}</View>
    </View>
  );
}

function Toggle({
  value,
  onToggle,
  label,
}: {
  value: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <Pressable
      style={[prim.toggle, value && prim.toggleOn]}
      onPress={onToggle}
    >
      <View style={[prim.toggleThumb, value && prim.toggleThumbOn]} />
      {label ? (
        <Text style={[prim.toggleLabel, value && prim.toggleLabelOn]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={prim.stepper}>
      <Pressable style={prim.stepBtn} onPress={dec} disabled={value <= min}>
        <Feather name="minus" size={14} color={value <= min ? "#ccc" : Colors.light.navyDark} />
      </Pressable>
      <Text style={prim.stepVal}>{format ? format(value) : value}</Text>
      <Pressable style={prim.stepBtn} onPress={inc} disabled={value >= max}>
        <Feather name="plus" size={14} color={value >= max ? "#ccc" : Colors.light.navyDark} />
      </Pressable>
    </View>
  );
}

function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (t: string) => void;
}) {
  const parts = value.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const setH = (v: number) =>
    onChange(`${v.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  const setM = (v: number) =>
    onChange(`${h.toString().padStart(2, "0")}:${v.toString().padStart(2, "0")}`);
  return (
    <View style={prim.timePicker}>
      <Stepper value={h} min={0} max={23} onChange={setH} format={(v) => v.toString().padStart(2, "0")} />
      <Text style={prim.timeSep}>:</Text>
      <Stepper value={m} min={0} max={55} step={5} onChange={setM} format={(v) => v.toString().padStart(2, "0")} />
    </View>
  );
}

function DaySelector({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (d: number) => {
    if (selected.includes(d)) {
      onChange(selected.filter((x) => x !== d));
    } else {
      onChange([...selected, d].sort());
    }
  };
  return (
    <View style={prim.dayRow}>
      {DAY_LABELS.map((label, i) => (
        <Pressable
          key={i}
          style={[prim.dayBtn, selected.includes(i) && prim.dayBtnOn]}
          onPress={() => toggle(i)}
        >
          <Text style={[prim.dayBtnText, selected.includes(i) && prim.dayBtnTextOn]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function MicroTypeEditor({
  types,
  onChange,
}: {
  types: { type: BlockType; ratio: number }[];
  onChange: (t: { type: BlockType; ratio: number }[]) => void;
}) {
  const hasType = (t: BlockType) => types.some((x) => x.type === t);
  const toggleType = (t: BlockType) => {
    if (hasType(t)) {
      onChange(types.filter((x) => x.type !== t));
    } else {
      onChange([...types, { type: t, ratio: 1 }]);
    }
  };
  const setRatio = (t: BlockType, r: number) => {
    onChange(types.map((x) => (x.type === t ? { ...x, ratio: r } : x)));
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={prim.chipRow}>
        {MICRO_TYPE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.type}
            style={[prim.chip, hasType(opt.type) && prim.chipOn]}
            onPress={() => toggleType(opt.type)}
          >
            <Feather
              name={opt.icon as never}
              size={12}
              color={hasType(opt.type) ? "#fff" : Colors.light.textSecondary}
            />
            <Text style={[prim.chipText, hasType(opt.type) && prim.chipTextOn]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {types.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={prim.subLabel}>Ratio (higher = more slots)</Text>
          {types.map((t) => (
            <Row key={t.type} label={t.type.charAt(0).toUpperCase() + t.type.slice(1)}>
              <Stepper value={t.ratio} min={1} max={10} onChange={(r) => setRatio(t.type, r)} />
            </Row>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function WelcomeStep() {
  return (
    <View style={s.stepContent}>
      <View style={s.iconCircle}>
        <Feather name="layers" size={36} color={Colors.light.navyDark} />
      </View>
      <Text style={s.stepTitle}>Schedule Setup</Text>
      <Text style={s.stepSubtitle}>
        Build your template schedule in a few steps. The app will generate
        recurring time blocks that fit your life — meals, work, workouts,
        and micro-tasks.
      </Text>
      <View style={s.infoBox}>
        <Text style={s.infoText}>
          Everything generated here becomes a reusable template. You can edit,
          delete, or add more templates at any time from the Templates screen.
        </Text>
      </View>
      <View style={s.bulletList}>
        {[
          "Wake & bedtime anchor",
          "Meal spacing (deterministic math)",
          "Work, commute, workouts",
          "Micro-block void fill",
        ].map((b) => (
          <View key={b} style={s.bulletRow}>
            <View style={s.bulletDot} />
            <Text style={s.bulletText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function WakeBedStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Wake & Bedtime</Text>
      <Text style={s.stepSubtitle}>
        These are your anchors. Wake and Bed templates will be 2-minute windows
        (±1 min). Any block logged between bedtime and wake is flagged as a
        potential sleep disturbance.
      </Text>

      <View style={s.card}>
        <Row label="Wake time">
          <TimePicker
            value={config.wakeTime}
            onChange={(t) => setConfig((c) => ({ ...c, wakeTime: t }))}
          />
        </Row>
        <View style={s.divider} />
        <Row label="Bedtime">
          <TimePicker
            value={config.bedTime}
            onChange={(t) => setConfig((c) => ({ ...c, bedTime: t }))}
          />
        </Row>
      </View>

      <View style={s.infoBox}>
        <Text style={s.infoText}>
          Sleep disturbance = runtime flag only. No template is created for
          the sleep window — it is evaluated dynamically from logs.
        </Text>
      </View>
    </View>
  );
}

function MealsStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Meals</Text>
      <Text style={s.stepSubtitle}>
        Meals are 10-minute slots, spaced equally between wake-end and
        bedtime-start using deterministic math.
      </Text>

      <View style={s.card}>
        <Row label="Number of meals">
          <Stepper
            value={config.mealCount}
            min={1}
            max={7}
            onChange={(v) => setConfig((c) => ({ ...c, mealCount: v }))}
          />
        </Row>
      </View>

      <Text style={s.sectionLabel}>Workout-adjacent meals</Text>
      <View style={s.card}>
        <Row label="Do cardio?">
          <Toggle
            value={config.hasCardio}
            onToggle={() => setConfig((c) => ({ ...c, hasCardio: !c.hasCardio }))}
          />
        </Row>
        {config.hasCardio && (
          <>
            <View style={s.divider} />
            <Row label="Pre-cardio meal">
              <Toggle
                value={config.cardioPre}
                onToggle={() => setConfig((c) => ({ ...c, cardioPre: !c.cardioPre }))}
              />
            </Row>
            <View style={s.divider} />
            <Row label="Post-cardio meal">
              <Toggle
                value={config.cardioPost}
                onToggle={() => setConfig((c) => ({ ...c, cardioPost: !c.cardioPost }))}
              />
            </Row>
          </>
        )}
      </View>

      <View style={s.card}>
        <Row label="Do lifting?">
          <Toggle
            value={config.hasLift}
            onToggle={() => setConfig((c) => ({ ...c, hasLift: !c.hasLift }))}
          />
        </Row>
        {config.hasLift && (
          <>
            <View style={s.divider} />
            <Row label="Pre-lift meal">
              <Toggle
                value={config.liftPre}
                onToggle={() => setConfig((c) => ({ ...c, liftPre: !c.liftPre }))}
              />
            </Row>
            <View style={s.divider} />
            <Row label="Post-lift meal">
              <Toggle
                value={config.liftPost}
                onToggle={() => setConfig((c) => ({ ...c, liftPost: !c.liftPost }))}
              />
            </Row>
          </>
        )}
      </View>
    </View>
  );
}

function WorkoutsStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  const timeOptions: Array<{ value: ScheduleWizardConfig["cardioTime"]; label: string }> = [
    { value: "morning",   label: "Morning" },
    { value: "afternoon", label: "Afternoon" },
    { value: "evening",   label: "Evening" },
  ];

  if (!config.hasCardio && !config.hasLift) {
    return (
      <View style={s.stepContent}>
        <Text style={s.stepTitle}>Workouts</Text>
        <Text style={s.stepSubtitle}>
          You didn't select cardio or lifting in the previous step. Skip to
          continue.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Workouts</Text>
      <Text style={s.stepSubtitle}>
        Set duration and preferred time slot. If a morning workout doesn't fit
        before your commute, it will be pushed to the evening.
      </Text>

      {config.hasCardio && (
        <>
          <Text style={s.sectionLabel}>Cardio</Text>
          <View style={s.card}>
            <Row label="Duration (min)">
              <Stepper
                value={config.cardioMins}
                min={10}
                max={180}
                onChange={(v) => setConfig((c) => ({ ...c, cardioMins: v }))}
              />
            </Row>
            <View style={s.divider} />
            <Row label="Preferred time">
              <View style={prim.segmentRow}>
                {timeOptions.map((o) => (
                  <Pressable
                    key={o.value}
                    style={[prim.seg, config.cardioTime === o.value && prim.segOn]}
                    onPress={() => setConfig((c) => ({ ...c, cardioTime: o.value }))}
                  >
                    <Text style={[prim.segText, config.cardioTime === o.value && prim.segTextOn]}>
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Row>
          </View>
        </>
      )}

      {config.hasLift && (
        <>
          <Text style={s.sectionLabel}>Lifting</Text>
          <View style={s.card}>
            <Row label="Duration (min)">
              <Stepper
                value={config.liftMins}
                min={10}
                max={180}
                onChange={(v) => setConfig((c) => ({ ...c, liftMins: v }))}
              />
            </Row>
            <View style={s.divider} />
            <Row label="Preferred time">
              <View style={prim.segmentRow}>
                {timeOptions.map((o) => (
                  <Pressable
                    key={o.value}
                    style={[prim.seg, config.liftTime === o.value && prim.segOn]}
                    onPress={() => setConfig((c) => ({ ...c, liftTime: o.value }))}
                  >
                    <Text style={[prim.segText, config.liftTime === o.value && prim.segTextOn]}>
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Row>
          </View>
        </>
      )}
    </View>
  );
}

function WorkStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Work period</Text>
      <Text style={s.stepSubtitle}>
        Work is a hard anchor. Templates are only placed on selected days.
      </Text>

      <View style={s.card}>
        <Row label="I have a job">
          <Toggle
            value={config.hasWork}
            onToggle={() => setConfig((c) => ({ ...c, hasWork: !c.hasWork }))}
          />
        </Row>
      </View>

      {config.hasWork && (
        <>
          <Text style={s.sectionLabel}>Work days</Text>
          <DaySelector
            selected={config.workDays}
            onChange={(d) => setConfig((c) => ({ ...c, workDays: d }))}
          />

          <Text style={s.sectionLabel}>Hours</Text>
          <View style={s.card}>
            <Row label="Start">
              <TimePicker
                value={config.workStart}
                onChange={(t) => setConfig((c) => ({ ...c, workStart: t }))}
              />
            </Row>
            <View style={s.divider} />
            <Row label="End">
              <TimePicker
                value={config.workEnd}
                onChange={(t) => setConfig((c) => ({ ...c, workEnd: t }))}
              />
            </Row>
          </View>
        </>
      )}
    </View>
  );
}

function CommuteStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  if (!config.hasWork) {
    return (
      <View style={s.stepContent}>
        <Text style={s.stepTitle}>Commute</Text>
        <Text style={s.stepSubtitle}>
          No work period selected — commute skipped. Continue to the next step.
        </Text>
      </View>
    );
  }

  const wStart = config.workStart.split(":").map(Number);
  const wh = wStart[0] ?? 9;
  const wm = wStart[1] ?? 0;
  const commAMStart = wh * 60 + wm - config.commuteMinutes;
  const wEnd = config.workEnd.split(":").map(Number);
  const eh = wEnd[0] ?? 17;
  const em = wEnd[1] ?? 0;
  const commPMEnd = eh * 60 + em + config.commuteMinutes;

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Commute</Text>
      <Text style={s.stepSubtitle}>
        Commute blocks are placed on work days only, bracketing your work
        start and end times.
      </Text>

      <View style={s.card}>
        <Row label="Has commute">
          <Toggle
            value={config.hasCommute}
            onToggle={() => setConfig((c) => ({ ...c, hasCommute: !c.hasCommute }))}
          />
        </Row>
        {config.hasCommute && (
          <>
            <View style={s.divider} />
            <Row label="Duration (min)">
              <Stepper
                value={config.commuteMinutes}
                min={5}
                max={120}
                onChange={(v) => setConfig((c) => ({ ...c, commuteMinutes: v }))}
              />
            </Row>
          </>
        )}
      </View>

      {config.hasCommute && (
        <View style={s.previewBox}>
          <Text style={s.previewLabel}>Preview</Text>
          <Text style={s.previewLine}>
            Commute AM: {fromMins(commAMStart)} → {config.workStart}
          </Text>
          <Text style={s.previewLine}>
            Commute PM: {config.workEnd} → {fromMins(commPMEnd)}
          </Text>
        </View>
      )}
    </View>
  );
}

function HygieneStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Hygiene</Text>
      <Text style={s.stepSubtitle}>
        Each shower is a 5-minute template. Showers are placed immediately
        after workouts when possible; extra showers go into the morning window.
      </Text>

      <View style={s.card}>
        <Row label="Showers per day">
          <Stepper
            value={config.showerCount}
            min={0}
            max={3}
            onChange={(v) => setConfig((c) => ({ ...c, showerCount: v }))}
          />
        </Row>
      </View>

      <View style={s.infoBox}>
        <Text style={s.infoText}>
          {config.showerCount === 0
            ? "No shower templates will be created."
            : `${config.showerCount} shower template${config.showerCount > 1 ? "s" : ""} will be created (5 min each).`}
        </Text>
      </View>
    </View>
  );
}

function MicroWeekdayStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Weekday micro-blocks</Text>
      <Text style={s.stepSubtitle}>
        The remaining void time on work days is packed with short recurring
        blocks. Choose a duration and which types to include (with ratios).
      </Text>

      <Text style={s.sectionLabel}>Block duration</Text>
      <View style={prim.chipRow}>
        {MICRO_SIZES.map((sz) => (
          <Pressable
            key={sz}
            style={[prim.chip, config.weekdayMicroSize === sz && prim.chipOn]}
            onPress={() => setConfig((c) => ({ ...c, weekdayMicroSize: sz }))}
          >
            <Text style={[prim.chipText, config.weekdayMicroSize === sz && prim.chipTextOn]}>
              {sz} min
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.sectionLabel}>Block types & ratios</Text>
      <MicroTypeEditor
        types={config.weekdayMicroTypes}
        onChange={(t) => setConfig((c) => ({ ...c, weekdayMicroTypes: t }))}
      />

      {config.weekdayMicroTypes.length === 0 && (
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            No types selected — no micro-blocks will be generated for weekdays.
          </Text>
        </View>
      )}
    </View>
  );
}

function MicroWeekendStep({
  config,
  setConfig,
}: {
  config: ScheduleWizardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScheduleWizardConfig>>;
}) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Weekend micro-blocks</Text>
      <Text style={s.stepSubtitle}>
        Non-work days have a fuller void (no work or commute). Weekend
        micro-blocks can be larger and more leisure-oriented.
      </Text>

      <Text style={s.sectionLabel}>Block duration</Text>
      <View style={prim.chipRow}>
        {MICRO_SIZES.map((sz) => (
          <Pressable
            key={sz}
            style={[prim.chip, config.weekendMicroSize === sz && prim.chipOn]}
            onPress={() => setConfig((c) => ({ ...c, weekendMicroSize: sz }))}
          >
            <Text style={[prim.chipText, config.weekendMicroSize === sz && prim.chipTextOn]}>
              {sz} min
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.sectionLabel}>Block types & ratios</Text>
      <MicroTypeEditor
        types={config.weekendMicroTypes}
        onChange={(t) => setConfig((c) => ({ ...c, weekendMicroTypes: t }))}
      />

      {config.weekendMicroTypes.length === 0 && (
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            No types selected — no micro-blocks will be generated for weekends.
          </Text>
        </View>
      )}
    </View>
  );
}

function GenerateStep({
  config,
  templateCount,
}: {
  config: ScheduleWizardConfig;
  templateCount: number;
}) {
  const wdNames = config.workDays
    .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
    .join(", ");

  const items: { label: string; value: string }[] = [
    { label: "Wake", value: config.wakeTime },
    { label: "Bedtime", value: config.bedTime },
    { label: "Meals", value: `${config.mealCount} meals` },
    config.hasCardio
      ? { label: "Cardio", value: `${config.cardioMins} min — ${config.cardioTime}` }
      : null,
    config.hasLift
      ? { label: "Lifting", value: `${config.liftMins} min — ${config.liftTime}` }
      : null,
    config.hasWork
      ? { label: "Work", value: `${config.workStart}–${config.workEnd} (${wdNames})` }
      : null,
    config.hasWork && config.hasCommute
      ? { label: "Commute", value: `${config.commuteMinutes} min each way` }
      : null,
    config.showerCount > 0
      ? { label: "Showers", value: `${config.showerCount}×day` }
      : null,
    config.weekdayMicroTypes.length > 0
      ? {
          label: "WD micro-blocks",
          value: `${config.weekdayMicroSize} min — ${config.weekdayMicroTypes.map((t) => t.type).join(", ")}`,
        }
      : null,
    config.weekendMicroTypes.length > 0
      ? {
          label: "WE micro-blocks",
          value: `${config.weekendMicroSize} min — ${config.weekendMicroTypes.map((t) => t.type).join(", ")}`,
        }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Ready to build</Text>
      <Text style={s.stepSubtitle}>
        {templateCount} templates will be generated and added to your library.
        You can edit or delete any of them afterwards.
      </Text>

      <View style={s.card}>
        {items.map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>{item.label}</Text>
              <Text style={s.summaryValue}>{item.value}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function SetupWizard({ forceVisible = false }: { forceVisible?: boolean }) {
  const insets = useSafeAreaInsets();
  const { completeSetupWizard, isLoaded, state } = useApp();
  const [step, setStep] = useState<Step>("welcome");
  const [config, setConfig] = useState<ScheduleWizardConfig>(DEFAULT_CONFIG);

  if (!forceVisible && (!isLoaded || !state.onboardingComplete || state.setupWizardComplete)) {
    return null;
  }

  const stepIndex = STEPS.indexOf(step);
  const isFirst = stepIndex === 0;
  const isLast = step === "generate";

  const templates = buildSchedule(config);

  function handleNext() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) {
      setStep(STEPS[i + 1]!);
    } else {
      completeSetupWizard(config, templates);
    }
  }

  function handleBack() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]!);
  }

  function handleSkip() {
    completeSetupWizard(config, []);
  }

  const stepLabel = (() => {
    switch (step) {
      case "welcome": return "";
      case "wake_bed": return "Wake & Bed";
      case "meals": return "Meals";
      case "workouts": return "Workouts";
      case "work": return "Work";
      case "commute": return "Commute";
      case "hygiene": return "Hygiene";
      case "micro_wd": return "Weekday Fill";
      case "micro_we": return "Weekend Fill";
      case "generate": return "Review";
    }
  })();

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                { width: `${((stepIndex + 1) / STEPS.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={s.stepCountLabel}>
            {stepLabel ? `${stepIndex} / ${STEPS.length - 1} — ${stepLabel}` : "Schedule Setup"}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === "welcome"   && <WelcomeStep />}
          {step === "wake_bed"  && <WakeBedStep config={config} setConfig={setConfig} />}
          {step === "meals"     && <MealsStep config={config} setConfig={setConfig} />}
          {step === "workouts"  && <WorkoutsStep config={config} setConfig={setConfig} />}
          {step === "work"      && <WorkStep config={config} setConfig={setConfig} />}
          {step === "commute"   && <CommuteStep config={config} setConfig={setConfig} />}
          {step === "hygiene"   && <HygieneStep config={config} setConfig={setConfig} />}
          {step === "micro_wd"  && <MicroWeekdayStep config={config} setConfig={setConfig} />}
          {step === "micro_we"  && <MicroWeekendStep config={config} setConfig={setConfig} />}
          {step === "generate"  && <GenerateStep config={config} templateCount={templates.length} />}
        </ScrollView>

        {/* Navigation */}
        <View style={[s.navRow, { paddingBottom: insets.bottom + 16 }]}>
          {!isFirst ? (
            <Pressable style={s.backBtn} onPress={handleBack}>
              <Feather name="arrow-left" size={18} color={Colors.light.textSecondary} />
              <Text style={s.backText}>Back</Text>
            </Pressable>
          ) : (
            <Pressable style={s.skipBtn} onPress={handleSkip}>
              <Text style={s.skipText}>Skip setup</Text>
            </Pressable>
          )}

          <Pressable style={s.nextBtn} onPress={handleNext}>
            <Text style={s.nextText}>
              {isLast ? "Build my schedule" : "Continue"}
            </Text>
            <Feather
              name={isLast ? "check" : "arrow-right"}
              size={16}
              color="#fff"
            />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Primitive styles ─────────────────────────────────────────────────────────

const prim = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: Colors.light.navyDark,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
  },
  toggleLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  toggleLabelOn: {
    color: "#fff",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: "center",
    alignItems: "center",
  },
  stepVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.light.navyDark,
    minWidth: 28,
    textAlign: "center",
  },
  timePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeSep: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.light.navyDark,
  },
  dayRow: {
    flexDirection: "row",
    gap: 6,
  },
  dayBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  dayBtnOn: {
    backgroundColor: Colors.light.navyDark,
    borderColor: Colors.light.navyDark,
  },
  dayBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  dayBtnTextOn: {
    color: "#fff",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  chipOn: {
    backgroundColor: Colors.light.navyDark,
    borderColor: Colors.light.navyDark,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  chipTextOn: {
    color: "#fff",
  },
  subLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  segmentRow: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: "hidden",
  },
  seg: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.light.surface,
  },
  segOn: {
    backgroundColor: Colors.light.navyDark,
  },
  segText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  segTextOn: {
    color: "#fff",
  },
});

// ─── Wizard-level styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.navyDark,
  },
  stepCountLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContent: {
    gap: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
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
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 21,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: -14,
    marginVertical: 2,
  },
  infoBox: {
    backgroundColor: Colors.light.cream,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.navyDark + "66",
  },
  infoText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.navyDark,
  },
  bulletText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.text,
  },
  previewBox: {
    backgroundColor: Colors.light.sage + "22",
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  previewLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.navyDark,
    marginBottom: 4,
  },
  previewLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.text,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 2,
  },
  summaryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.navyDark,
    flex: 1,
    textAlign: "right",
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
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.textSecondary,
    textDecorationLine: "underline",
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
