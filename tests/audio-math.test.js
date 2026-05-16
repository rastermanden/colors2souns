import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCALES,
  midiToFreq,
  clamp,
  clampInt,
  lerp,
  rgbToHsl,
  pitchFromHue,
} from "../lib/audio-math.js";

const EPS = 1e-9;

const closeTo = (actual, expected, eps = EPS) =>
  assert.ok(
    Math.abs(actual - expected) < eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  );

const hslCloseTo = (actual, expected, eps = 1e-9) => {
  assert.equal(actual.length, 3);
  closeTo(actual[0], expected[0], eps);
  closeTo(actual[1], expected[1], eps);
  closeTo(actual[2], expected[2], eps);
};

// ---------- clamp / clampInt / lerp ----------

test("clamp: returns x when inside range", () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test("clamp: clamps below the floor and above the ceiling", () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test("clamp: handles equal bounds", () => {
  assert.equal(clamp(5, 3, 3), 3);
});

test("clampInt: clamps then rounds to nearest integer", () => {
  assert.equal(clampInt(3.4, 0, 10), 3);
  assert.equal(clampInt(3.6, 0, 10), 4);
  assert.equal(clampInt(-2.7, 0, 10), 0);
  assert.equal(clampInt(12.9, 0, 10), 10);
});

test("lerp: endpoints and midpoint", () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test("lerp: extrapolates past the endpoints", () => {
  assert.equal(lerp(0, 10, 2), 20);
  assert.equal(lerp(0, 10, -1), -10);
});

// ---------- midiToFreq ----------

test("midiToFreq: A4 = 69 → 440 Hz", () => {
  assert.equal(midiToFreq(69), 440);
});

test("midiToFreq: octaves above and below A4", () => {
  closeTo(midiToFreq(57), 220); // A3
  closeTo(midiToFreq(81), 880); // A5
  closeTo(midiToFreq(45), 110); // A2
});

test("midiToFreq: C4 ≈ 261.63 Hz", () => {
  closeTo(midiToFreq(60), 261.6255653005986, 1e-9);
});

// ---------- SCALES ----------

test("SCALES.off is null (means continuous)", () => {
  assert.equal(SCALES.off, null);
});

test("every non-null scale is strictly ascending and inside [0, 12)", () => {
  for (const [name, steps] of Object.entries(SCALES)) {
    if (steps === null) continue;
    assert.ok(steps.length > 0, `${name} is empty`);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      assert.ok(
        Number.isInteger(s) && s >= 0 && s < 12,
        `${name}[${i}] = ${s} is out of range`,
      );
      if (i > 0) {
        assert.ok(
          steps[i] > steps[i - 1],
          `${name} not strictly ascending at index ${i}`,
        );
      }
    }
  }
});

test("major scale has 7 notes, chromatic has 12, pentatonic has 5", () => {
  assert.equal(SCALES.major.length, 7);
  assert.equal(SCALES.chromatic.length, 12);
  assert.equal(SCALES.pentatonic.length, 5);
});

// ---------- rgbToHsl ----------

test("rgbToHsl: black", () => {
  hslCloseTo(rgbToHsl(0, 0, 0), [0, 0, 0]);
});

test("rgbToHsl: white", () => {
  hslCloseTo(rgbToHsl(1, 1, 1), [0, 0, 1]);
});

test("rgbToHsl: mid grey is achromatic", () => {
  hslCloseTo(rgbToHsl(0.5, 0.5, 0.5), [0, 0, 0.5]);
});

test("rgbToHsl: pure red, green, blue map to 0, 1/3, 2/3 hue", () => {
  hslCloseTo(rgbToHsl(1, 0, 0), [0, 1, 0.5]);
  hslCloseTo(rgbToHsl(0, 1, 0), [1 / 3, 1, 0.5]);
  hslCloseTo(rgbToHsl(0, 0, 1), [2 / 3, 1, 0.5]);
});

test("rgbToHsl: yellow and cyan land on 1/6 and 1/2", () => {
  hslCloseTo(rgbToHsl(1, 1, 0), [1 / 6, 1, 0.5]);
  hslCloseTo(rgbToHsl(0, 1, 1), [1 / 2, 1, 0.5]);
});

test("rgbToHsl: high-lightness branch (l > 0.5) computes saturation correctly", () => {
  // Pale red: max=1, min=0.8, l=0.9 → s = (1 - 0.8) / (2 - 1 - 0.8) = 1
  hslCloseTo(rgbToHsl(1, 0.8, 0.8), [0, 1, 0.9]);
});

// ---------- pitchFromHue: continuous (scale=null) ----------

test("pitchFromHue continuous: h=0 returns baseFreq", () => {
  assert.equal(pitchFromHue(0, 100, 4, null), 100);
});

test("pitchFromHue continuous: h=1 returns baseFreq * 2^octaves", () => {
  closeTo(pitchFromHue(1, 100, 4, null), 1600);
  closeTo(pitchFromHue(1, 110, 2, null), 440);
});

test("pitchFromHue continuous: h=0.5 sits at half the octave range", () => {
  closeTo(pitchFromHue(0.5, 100, 4, null), 400); // 100 * 2^2
});

// ---------- pitchFromHue: quantized to a scale ----------

test("pitchFromHue quantized: h=0 sits on the scale root", () => {
  assert.equal(pitchFromHue(0, 100, 2, SCALES.major), 100);
  assert.equal(pitchFromHue(0, 220, 1, SCALES.minor), 220);
});

test("pitchFromHue quantized: chromatic 1-octave hits all 12 semitones", () => {
  for (let i = 0; i < 12; i++) {
    const h = (i + 0.5) / 12; // sample the middle of each bucket
    closeTo(
      pitchFromHue(h, 100, 1, SCALES.chromatic),
      100 * Math.pow(2, i / 12),
    );
  }
});

test("pitchFromHue quantized: top of range stays inside requested octaves", () => {
  // major, 2 octaves: total=14, idx=13, oct=1, step=11 → 100 * 2^(1 + 11/12)
  const f = pitchFromHue(0.999, 100, 2, SCALES.major);
  closeTo(f, 100 * Math.pow(2, 1 + 11 / 12), 1e-6);
  assert.ok(f < 100 * Math.pow(2, 2), "should not exceed octaves=2 ceiling");
});

test("pitchFromHue quantized: h=1 is clamped to the last bucket (does not overflow)", () => {
  const top = pitchFromHue(0.999999, 100, 2, SCALES.major);
  const at1 = pitchFromHue(1, 100, 2, SCALES.major);
  closeTo(at1, top, 1e-6);
});

test("pitchFromHue quantized: fractional octaves still produce ≥1 pitch", () => {
  // octaves=0.1, major (7) → total = max(1, round(0.7)) = 1
  const f = pitchFromHue(0, 100, 0.1, SCALES.major);
  assert.equal(f, 100);
  // h=1 must not crash or NaN
  const f1 = pitchFromHue(1, 100, 0.1, SCALES.major);
  assert.equal(Number.isFinite(f1), true);
});
