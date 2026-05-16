// Pure helpers shared by app.js and tested in isolation by tests/.
// Keep this file free of DOM/AudioContext references.

export const SCALES = {
  off: null,
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
};

export function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
export function clampInt(x, lo, hi) { return Math.round(clamp(x, lo, hi)); }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function pitchFromHue(h, baseFreq, octaves, scale) {
  if (!scale) {
    return baseFreq * Math.pow(2, h * octaves);
  }
  const total = Math.max(1, Math.round(scale.length * octaves));
  const idx = Math.min(total - 1, Math.floor(h * total));
  const oct = Math.floor(idx / scale.length);
  const step = scale[idx % scale.length];
  return baseFreq * Math.pow(2, oct + step / 12);
}
