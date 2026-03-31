import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeWarfarinCase,
  buildBalancedSchedule,
  expandPattern,
  parseDosePattern,
  sumSchedule
} from "../src/warfarin.js";

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

test("buildBalancedSchedule preserves weekly total", () => {
  const schedule = buildBalancedSchedule(5.5);
  assert.equal(schedule.length, 7);
  assert.equal(sumSchedule(schedule), 5.5);
});

test("slightly low INR after a previously in-range INR can keep same weekly dose", () => {
  const result = analyzeWarfarinCase({
    targetKey: "standard",
    tabletStrengthMg: 5,
    currentInr: 1.9,
    currentDate: "2026-03-31",
    previousInr: 2.4,
    previousDate: "2026-03-10",
    weeklySchedule: expandPattern([1], 7),
    intervalPattern: "",
    transientFactor: "none",
    activeBleeding: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.highRisk, false);
  assert.equal(result.adjustmentPercent, 0);
  assert.equal(result.recommendedWeeklyTablets, 7);
});

test("low INR without transient explanation increases weekly dose", () => {
  const result = analyzeWarfarinCase({
    targetKey: "standard",
    tabletStrengthMg: 5,
    currentInr: 1.7,
    currentDate: "2026-03-31",
    previousInr: 2.3,
    previousDate: "2026-03-10",
    weeklySchedule: expandPattern([1], 7),
    intervalPattern: "",
    transientFactor: "none",
    activeBleeding: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.adjustmentPercent, 5);
  assert.equal(result.recommendedWeeklyTablets, 7.5);
});

test("very high INR stops automated maintenance advice", () => {
  const result = analyzeWarfarinCase({
    targetKey: "standard",
    tabletStrengthMg: 5,
    currentInr: 5.2,
    currentDate: "2026-03-31",
    previousInr: 3.6,
    previousDate: "2026-03-20",
    weeklySchedule: expandPattern([1], 7),
    intervalPattern: "",
    transientFactor: "none",
    activeBleeding: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.highRisk, true);
});
