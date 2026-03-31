import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeWarfarinCase,
  buildBalancedSchedule,
  classifyInr,
  expandPattern,
  normalizeTurkish,
  parseDosePattern,
  sumSchedule,
  TARGETS
} from "../src/warfarin.js";

// ─── normalizeTurkish ───────────────────────────────────────────────

test("normalizeTurkish lowercases and strips Turkish special chars", () => {
  assert.equal(normalizeTurkish("Çarşamba"), "carsamba");
  assert.equal(normalizeTurkish("Perşembe"), "persembe");
  assert.equal(normalizeTurkish("ÖĞLE"), "ogle");
});

test("normalizeTurkish handles uppercase İ and I correctly", () => {
  assert.equal(normalizeTurkish("İLAÇ"), "ilac");
  assert.equal(normalizeTurkish("INR"), "inr");
  assert.equal(normalizeTurkish("İNR"), "inr");
});

test("normalizeTurkish collapses whitespace", () => {
  assert.equal(normalizeTurkish("  her   gun  "), "her gun");
});

test("normalizeTurkish handles empty/null input", () => {
  assert.equal(normalizeTurkish(""), "");
  assert.equal(normalizeTurkish(undefined), "");
  assert.equal(normalizeTurkish(null), "null");
});

// ─── parseDosePattern ───────────────────────────────────────────────

test("parses a daily tablet pattern", () => {
  const parsed = parseDosePattern("her gun 2 adet (10 mg)", 5);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.cycle, [2]);
});

test("parses alternating daily pattern", () => {
  const parsed = parseDosePattern("1 gun 1 adet 1 gun yarim", 5);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.cycle, [1, 0.5]);
});

test("parses named-day schedule", () => {
  const parsed = parseDosePattern("pzt 1, sali 1, carsamba 0.5, persembe 1, cuma 1, cumartesi 0.5, pazar 1", 5);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.source, "named-days");
  assert.deepEqual(parsed.cycle, [1, 1, 0.5, 1, 1, 0.5, 1]);
});

test("parses mg-based dose input", () => {
  const parsed = parseDosePattern("her gun 10 mg", 5);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.cycle, [2]);
});

test("parses ceyrek (quarter tablet)", () => {
  const parsed = parseDosePattern("her gun ceyrek", 5);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.cycle, [0.25]);
});

test("parses bir bucuk (one and a half)", () => {
  const parsed = parseDosePattern("her gun bir bucuk", 5);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.cycle, [1.5]);
});

test("parses comma-separated list", () => {
  const parsed = parseDosePattern("1, 1, 0.5, 1, 1, 0.5, 1", 5);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.source, "list");
  assert.deepEqual(parsed.cycle, [1, 1, 0.5, 1, 1, 0.5, 1]);
});

test("returns error for empty pattern", () => {
  const parsed = parseDosePattern("", 5);
  assert.equal(parsed.ok, false);
});

test("returns error for unparseable pattern", () => {
  const parsed = parseDosePattern("xyz abc", 5);
  assert.equal(parsed.ok, false);
});

test("does not incorrectly split on '11 gun'", () => {
  const parsed = parseDosePattern("11 gun boyunca 1 adet", 5);
  assert.equal(parsed.ok, true);
  assert.notEqual(parsed.source, "alternating");
});

// ─── expandPattern ──────────────────────────────────────────────────

test("expandPattern handles empty array", () => {
  assert.deepEqual(expandPattern([]), []);
});

test("expandPattern repeats single element to 7 days", () => {
  assert.deepEqual(expandPattern([1], 7), [1, 1, 1, 1, 1, 1, 1]);
});

test("expandPattern cycles 2-element array to 14 days", () => {
  const result = expandPattern([1, 0.5], 14);
  assert.equal(result.length, 14);
  assert.equal(result[0], 1);
  assert.equal(result[1], 0.5);
  assert.equal(result[12], 1);
  assert.equal(result[13], 0.5);
});

// ─── buildBalancedSchedule ──────────────────────────────────────────

test("buildBalancedSchedule preserves weekly total", () => {
  const schedule = buildBalancedSchedule(5.5);
  assert.equal(schedule.length, 7);
  assert.equal(sumSchedule(schedule), 5.5);
});

test("buildBalancedSchedule handles zero dose", () => {
  const schedule = buildBalancedSchedule(0);
  assert.deepEqual(schedule, [0, 0, 0, 0, 0, 0, 0]);
});

test("buildBalancedSchedule handles uniform dose (7 tablets)", () => {
  const schedule = buildBalancedSchedule(7);
  assert.deepEqual(schedule, [1, 1, 1, 1, 1, 1, 1]);
});

test("buildBalancedSchedule handles high dose (14 tablets)", () => {
  const schedule = buildBalancedSchedule(14);
  assert.equal(sumSchedule(schedule), 14);
  schedule.forEach((dose) => assert.equal(dose, 2));
});

test("buildBalancedSchedule handles 3.5 tablets evenly", () => {
  const schedule = buildBalancedSchedule(3.5);
  assert.equal(sumSchedule(schedule), 3.5);
  assert.equal(schedule.length, 7);
});

// ─── classifyInr ────────────────────────────────────────────────────

test("classifyInr returns veryLow when INR far below target", () => {
  assert.equal(classifyInr(1.2, TARGETS.standard), "veryLow");
});

test("classifyInr returns low when INR moderately below target", () => {
  assert.equal(classifyInr(1.7, TARGETS.standard), "low");
});

test("classifyInr returns slightlyLow when INR just below target", () => {
  assert.equal(classifyInr(1.9, TARGETS.standard), "slightlyLow");
});

test("classifyInr returns inRange when INR within target", () => {
  assert.equal(classifyInr(2.5, TARGETS.standard), "inRange");
});

test("classifyInr returns slightlyHigh when INR just above target", () => {
  assert.equal(classifyInr(3.2, TARGETS.standard), "slightlyHigh");
});

test("classifyInr returns mildHigh when INR moderately above target", () => {
  assert.equal(classifyInr(3.4, TARGETS.standard), "mildHigh");
});

test("classifyInr returns high when INR significantly above target", () => {
  assert.equal(classifyInr(3.8, TARGETS.standard), "high");
});

test("classifyInr returns veryHigh when INR far above target", () => {
  assert.equal(classifyInr(4.5, TARGETS.standard), "veryHigh");
});

test("classifyInr works with high target range (2.5-3.5)", () => {
  assert.equal(classifyInr(2.8, TARGETS.high), "inRange");
  assert.equal(classifyInr(2.0, TARGETS.high), "low");
  assert.equal(classifyInr(4.0, TARGETS.high), "high");
});

// ─── analyzeWarfarinCase ────────────────────────────────────────────

const baseCase = {
  targetKey: "standard",
  tabletStrengthMg: 5,
  currentDate: "2026-03-31",
  previousDate: "2026-03-10",
  weeklySchedule: expandPattern([1], 7),
  intervalPattern: "",
  transientFactor: "none",
  activeBleeding: false
};

test("slightly low INR after a previously in-range INR keeps same weekly dose", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 1.9,
    previousInr: 2.4
  });
  assert.equal(result.ok, true);
  assert.equal(result.highRisk, false);
  assert.equal(result.adjustmentPercent, 0);
  assert.equal(result.recommendedWeeklyTablets, 7);
});

test("low INR without transient explanation increases weekly dose", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 1.7,
    previousInr: 2.3
  });
  assert.equal(result.ok, true);
  assert.equal(result.adjustmentPercent, 5);
  assert.equal(result.recommendedWeeklyTablets, 7.5);
});

test("very high INR stops automated maintenance advice", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 5.2,
    previousInr: 3.6,
    previousDate: "2026-03-20"
  });
  assert.equal(result.ok, true);
  assert.equal(result.highRisk, true);
});

test("active bleeding triggers high risk lockout", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 2.5,
    previousInr: 2.5,
    activeBleeding: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.highRisk, true);
  assert.ok(result.title.includes("Acil"));
});

test("interval pattern overrides basis dose calculation", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 2.5,
    previousInr: 2.5,
    intervalPattern: "her gun 2 adet"
  });
  assert.equal(result.ok, true);
  assert.equal(result.basisWeeklyDoseTablets, 14);
  assert.ok(result.historySummary !== null);
});

test("consecutive low trend increases adjustment aggressiveness", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 1.7,
    previousInr: 1.8
  });
  assert.equal(result.ok, true);
  assert.equal(result.adjustmentPercent, 15);
});

test("consecutive high trend increases reduction aggressiveness", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 3.8,
    previousInr: 3.5
  });
  assert.equal(result.ok, true);
  assert.equal(result.adjustmentPercent, -15);
});

test("transient factor dampens low INR adjustment", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 1.7,
    previousInr: 2.5,
    transientFactor: "low"
  });
  assert.equal(result.ok, true);
  assert.equal(result.adjustmentPercent, 5);
});

test("transient factor dampens high INR adjustment", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 3.8,
    previousInr: 2.5,
    transientFactor: "high"
  });
  assert.equal(result.ok, true);
  assert.equal(result.adjustmentPercent, -10);
});

test("validation rejects invalid INR", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: NaN,
    previousInr: 2.5
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("validation rejects reversed dates", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 2.5,
    previousInr: 2.5,
    currentDate: "2026-03-01",
    previousDate: "2026-03-31"
  });
  assert.equal(result.ok, false);
});

test("in-range INR sets next check at 28 days when previously in-range", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 2.5,
    previousInr: 2.5
  });
  assert.equal(result.ok, true);
  assert.equal(result.nextInrDays, 28);
});

test("in-range INR sets next check at 21 days when newly achieved", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 2.5,
    previousInr: 1.7
  });
  assert.equal(result.ok, true);
  assert.equal(result.nextInrDays, 21);
});

test("veryHigh INR below 5 does not trigger highRisk lockout", () => {
  const result = analyzeWarfarinCase({
    ...baseCase,
    currentInr: 4.5,
    previousInr: 3.0
  });
  assert.equal(result.ok, true);
  assert.equal(result.highRisk, false);
  assert.equal(result.currentStatus, "veryHigh");
});
