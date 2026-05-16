// colors2souns — image → sound
// Loads an image into a canvas, samples columns over time, and drives an
// oscillator bank where each vertical band controls one voice.

const $ = (id) => document.getElementById(id);

const ui = {
  file: $("file"),
  drop: $("drop"),
  previewCard: $("previewCard"),
  controlsCard: $("controlsCard"),
  canvas: $("canvas"),
  scan: $("scan"),
  play: $("play"),
  stop: $("stop"),
  now: $("now"),
  duration: $("duration"),
  density: $("density"),
  baseFreq: $("baseFreq"),
  octaves: $("octaves"),
  hueShift: $("hueShift"),
  direction: $("direction"),
  mode: $("mode"),
  rNote: $("rNote"),
  gNote: $("gNote"),
  bNote: $("bNote"),
  quantize: $("quantize"),
  wave: $("wave"),
  brightness: $("brightness"),
  saturation: $("saturation"),
  vrows: $("vrows"),
  gain: $("gain"),
  loop: $("loop"),
  out: {
    duration: $("durationOut"),
    density: $("densityOut"),
    baseFreq: $("baseFreqOut"),
    octaves: $("octavesOut"),
    hueShift: $("hueShiftOut"),
    brightness: $("brightnessOut"),
    saturation: $("saturationOut"),
    vrows: $("vrowsOut"),
    gain: $("gainOut"),
  },
};

const ctx2d = ui.canvas.getContext("2d", { willReadFrequently: true });

// State
let imgBitmap = null;
let sampleData = null; // { cols, rows, rgb: Float32Array[cols*rows*3], dir, mode }
let audio = null;      // { ac, master, voices: [{osc, gain, filter}] }
let playState = { playing: false, startedAt: 0, raf: 0 };

// ---------- UI helpers ----------

const SCALES = {
  off: null,
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
};

function fmt() {
  ui.out.duration.value = `${(+ui.duration.value).toFixed(1)} s`;
  ui.out.density.value = `${ui.density.value} cols`;
  ui.out.baseFreq.value = `${ui.baseFreq.value} Hz`;
  ui.out.octaves.value = `${(+ui.octaves.value).toFixed(1)} oct`;
  ui.out.hueShift.value = `${ui.hueShift.value}°`;
  ui.out.brightness.value = `${ui.brightness.value}%`;
  ui.out.saturation.value = `${ui.saturation.value}%`;
  ui.out.vrows.value = `${ui.vrows.value}`;
  ui.out.gain.value = `${ui.gain.value}%`;
}
fmt();

for (const k of ["duration", "density", "baseFreq", "octaves", "hueShift",
                 "brightness", "saturation", "vrows", "gain"]) {
  ui[k].addEventListener("input", () => {
    fmt();
    if (k === "density" || k === "vrows") resample();
  });
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

ui.mode.addEventListener("change", () => {
  ui.controlsCard.dataset.mode = ui.mode.value;
  resample();
});

// ---------- Built-in samples ----------
// Two flavours: synthetic melodies (a `degrees` array of major-scale degrees
// painted as hue bands) and real images (a `src` URL). Both share a `preset`
// that configures the calibration sliders for the playback.
const MELODY_PRESET = {
  mode: "hue", quantize: "major", octaves: 2, baseFreq: 131,
  direction: "lr", hueShift: 0, vrows: 1,
  brightness: 110, saturation: 60, wave: "triangle",
};
const SAMPLES = [
  {
    name: "Twinkle",
    degrees: [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0],
    duration: 5,
    preset: MELODY_PRESET,
  },
  {
    name: "Mary",
    degrees: [2, 1, 0, 1, 2, 2, 2, 1, 1, 1, 2, 4, 4],
    duration: 4.5,
    preset: MELODY_PRESET,
  },
  {
    name: "Ode to Joy",
    degrees: [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1],
    duration: 5,
    preset: MELODY_PRESET,
  },
  {
    name: "Bosse",
    src: "./samples/bosse.jpg",
    duration: 10,
    density: 96,
    preset: {
      mode: "hue", quantize: "pentatonic", octaves: 3, baseFreq: 110,
      direction: "lr", hueShift: 0, vrows: 3,
      brightness: 120, saturation: 70, wave: "triangle",
    },
  },
];

function buildSampleCanvas(degrees) {
  const stepsPerOctave = 7;
  const octaves = 2;
  const total = stepsPerOctave * octaves; // 14 hue slots
  const bandW = 36;
  const w = degrees.length * bandW;
  const h = 200;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cc = c.getContext("2d");
  for (let i = 0; i < degrees.length; i++) {
    const idx = degrees[i];
    const hue = ((idx + 0.5) / total) * 360;
    cc.fillStyle = `hsl(${hue.toFixed(1)}, 85%, 55%)`;
    cc.fillRect(i * bandW, 0, bandW, h);
  }
  return c;
}

function applyPreset(p, sample) {
  ui.mode.value = p.mode;
  ui.controlsCard.dataset.mode = p.mode;
  ui.quantize.value = p.quantize;
  ui.octaves.value = p.octaves;
  ui.baseFreq.value = p.baseFreq;
  ui.direction.value = p.direction;
  ui.hueShift.value = p.hueShift;
  ui.vrows.value = p.vrows;
  ui.brightness.value = p.brightness;
  ui.saturation.value = p.saturation;
  ui.wave.value = p.wave;
  ui.duration.value = sample.duration;
  if (sample.density) {
    ui.density.value = sample.density;
  } else if (sample.degrees) {
    // Density a multiple of note count, so each sample column stays inside one band.
    ui.density.value = Math.min(256, sample.degrees.length * 8);
  }
  fmt();
}

async function loadSample(sample) {
  if (sample.src) {
    imgBitmap = await loadImage(sample.src);
  } else {
    imgBitmap = buildSampleCanvas(sample.degrees);
  }
  applyPreset(sample.preset, sample);
  drawImage();
  resample();
  ui.previewCard.hidden = false;
  ui.play.disabled = false;
  ui.stop.disabled = true;
}

function initSampleButtons() {
  const row = $("samples");
  if (!row) return;
  for (const s of SAMPLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sample-btn";
    b.textContent = s.name;
    b.addEventListener("click", () => loadSample(s));
    row.appendChild(b);
  }
}
initSampleButtons();

// ---------- File / image loading ----------

ui.file.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) loadFile(f);
});

["dragenter", "dragover"].forEach((ev) =>
  ui.drop.addEventListener(ev, (e) => {
    e.preventDefault();
    ui.drop.classList.add("over");
  })
);
["dragleave", "drop"].forEach((ev) =>
  ui.drop.addEventListener(ev, (e) => {
    e.preventDefault();
    ui.drop.classList.remove("over");
  })
);
ui.drop.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f && f.type.startsWith("image/")) loadFile(f);
});

async function loadFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    imgBitmap = img;
    drawImage();
    resample();
    ui.previewCard.hidden = false;
    ui.controlsCard.hidden = false;
    ui.play.disabled = false;
    ui.stop.disabled = true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImage() {
  // Fit within working size while preserving aspect ratio.
  const maxW = 480, maxH = 360;
  const r = Math.min(maxW / imgBitmap.width, maxH / imgBitmap.height, 1);
  const w = Math.max(1, Math.round(imgBitmap.width * r));
  const h = Math.max(1, Math.round(imgBitmap.height * r));
  ui.canvas.width = w;
  ui.canvas.height = h;
  ctx2d.drawImage(imgBitmap, 0, 0, w, h);
}

// ---------- Sampling ----------

function resample() {
  if (!imgBitmap) return;
  const cols = clampInt(+ui.density.value, 4, 512);
  const mode = ui.mode.value;
  const rows = mode === "rgb" ? 1 : clampInt(+ui.vrows.value, 1, 16);
  const dir = ui.direction.value;
  const horizontal = dir === "lr" || dir === "rl";
  const reverse = dir === "rl" || dir === "bt";
  const w = ui.canvas.width;
  const h = ui.canvas.height;
  const img = ctx2d.getImageData(0, 0, w, h).data;
  const rgb = new Float32Array(cols * rows * 3);

  for (let c = 0; c < cols; c++) {
    const t = reverse ? cols - 1 - c : c;
    for (let r = 0; r < rows; r++) {
      let x0, x1, y0, y1;
      if (horizontal) {
        x0 = Math.floor((t * w) / cols);
        x1 = Math.max(x0 + 1, Math.floor(((t + 1) * w) / cols));
        y0 = Math.floor((r * h) / rows);
        y1 = Math.max(y0 + 1, Math.floor(((r + 1) * h) / rows));
      } else {
        y0 = Math.floor((t * h) / cols);
        y1 = Math.max(y0 + 1, Math.floor(((t + 1) * h) / cols));
        x0 = Math.floor((r * w) / rows);
        x1 = Math.max(x0 + 1, Math.floor(((r + 1) * w) / rows));
      }
      let R = 0, G = 0, B = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * w + x0) * 4;
        for (let x = x0; x < x1; x++) {
          R += img[i]; G += img[i + 1]; B += img[i + 2];
          n++; i += 4;
        }
      }
      const o = (c * rows + r) * 3;
      rgb[o] = R / (n * 255);
      rgb[o + 1] = G / (n * 255);
      rgb[o + 2] = B / (n * 255);
    }
  }
  sampleData = { cols, rows, rgb, dir, mode };
}

ui.direction.addEventListener("change", resample);

function rgbToHsl(r, g, b) {
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

// ---------- Audio engine ----------

function ensureAudio(voices) {
  if (audio && audio.voices.length === voices) return audio;
  if (audio) stopAudio();

  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);

  const wave = ui.wave.value;
  const vs = [];
  for (let i = 0; i < voices; i++) {
    const osc = ac.createOscillator();
    osc.type = wave;
    osc.frequency.value = 220;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 8000;
    filter.Q.value = 0.7;
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    vs.push({ osc, filter, gain });
  }
  audio = { ac, master, voices: vs };
  return audio;
}

function stopAudio() {
  if (!audio) return;
  const { ac, voices, master } = audio;
  const t = ac.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0, t + 0.05);
  voices.forEach((v) => {
    try { v.osc.stop(t + 0.1); } catch {}
  });
  setTimeout(() => { try { ac.close(); } catch {} }, 200);
  audio = null;
}

ui.wave.addEventListener("change", () => {
  if (audio) audio.voices.forEach((v) => (v.osc.type = ui.wave.value));
});

// ---------- Playback ----------

ui.play.addEventListener("click", play);
ui.stop.addEventListener("click", () => stop(true));

async function play() {
  if (!sampleData) return;
  const { cols, rows, rgb } = sampleData;
  const mode = ui.mode.value;
  const duration = +ui.duration.value;
  const baseFreq = +ui.baseFreq.value;
  const octaves = +ui.octaves.value;
  const hueShift = (+ui.hueShift.value) / 360;
  const scaleName = ui.quantize.value;
  const scale = SCALES[scaleName];
  const brightness = (+ui.brightness.value) / 100;
  const saturation = (+ui.saturation.value) / 100;
  const masterVol = (+ui.gain.value) / 100;
  const loop = ui.loop.checked;

  const voiceCount = mode === "rgb" ? 3 : rows;
  const rgbFreqs = mode === "rgb"
    ? [+ui.rNote.value, +ui.gNote.value, +ui.bNote.value].map(midiToFreq)
    : null;

  const a = ensureAudio(voiceCount);
  const ac = a.ac;
  if (ac.state === "suspended") await ac.resume();

  const t0 = ac.currentTime + 0.05;
  const dt = duration / cols;
  // Schedule master fade-in
  a.master.gain.cancelScheduledValues(t0);
  a.master.gain.setValueAtTime(0, t0);
  a.master.gain.linearRampToValueAtTime(masterVol, t0 + 0.04);

  // Schedule per-voice automation.
  for (let v = 0; v < voiceCount; v++) {
    const voice = a.voices[v];
    voice.osc.type = ui.wave.value;
    voice.gain.gain.cancelScheduledValues(t0);
    voice.filter.frequency.cancelScheduledValues(t0);
    voice.osc.frequency.cancelScheduledValues(t0);

    if (mode === "rgb") {
      // Voice index maps to channel: 0=R, 1=G, 2=B. Fixed pitch from dropdown.
      voice.osc.frequency.setValueAtTime(rgbFreqs[v], t0);
    }

    for (let c = 0; c < cols; c++) {
      const tc = t0 + c * dt;
      let amp, cutoff;

      if (mode === "rgb") {
        const o = c * 3; // rows == 1
        const channel = rgb[o + v]; // 0..1
        amp = clamp(channel * brightness, 0, 1) * (1 / Math.sqrt(3));
        cutoff = lerp(400, 12000, clamp(channel * saturation + 0.05, 0, 1));
      } else {
        const o = (c * rows + v) * 3;
        const [hue, sat, lig] = rgbToHsl(rgb[o], rgb[o + 1], rgb[o + 2]);
        const h = (hue + hueShift) % 1;
        const freq = pitchFromHue(h, baseFreq, octaves, scale);
        amp = clamp(lig * brightness, 0, 1) * (1 / Math.sqrt(rows));
        cutoff = lerp(400, 12000, clamp(sat * saturation + 0.05, 0, 1));
        voice.osc.frequency.setValueAtTime(freq, tc);
      }

      // small ramps to avoid zipper noise and clicks
      voice.gain.gain.linearRampToValueAtTime(amp * 0.9, tc + dt * 0.5);
      voice.filter.frequency.linearRampToValueAtTime(cutoff, tc + dt * 0.5);
    }
    // tail
    voice.gain.gain.linearRampToValueAtTime(0, t0 + duration + 0.05);
  }

  playState.playing = true;
  playState.startedAt = t0;
  playState.duration = duration;
  playState.dir = ui.direction.value;
  const horizontalScan = playState.dir === "lr" || playState.dir === "rl";
  ui.scan.classList.toggle("vertical", horizontalScan);
  ui.scan.classList.toggle("horizontal", !horizontalScan);
  ui.scan.classList.add("on");
  ui.play.disabled = true;
  ui.stop.disabled = false;
  tick();

  // Stop or loop when done
  const endAt = t0 + duration;
  const remaining = Math.max(0, (endAt - ac.currentTime) * 1000);
  playState.timer = setTimeout(() => {
    if (loop && playState.playing) {
      play();
    } else {
      stop(false);
    }
  }, remaining + 80);
}

function stop(hard) {
  playState.playing = false;
  clearTimeout(playState.timer);
  cancelAnimationFrame(playState.raf);
  ui.scan.classList.remove("on");
  ui.play.disabled = false;
  ui.stop.disabled = true;
  ui.now.textContent = "—";
  if (audio) {
    const t = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(t);
    audio.master.gain.setValueAtTime(audio.master.gain.value, t);
    audio.master.gain.linearRampToValueAtTime(0, t + 0.08);
    audio.voices.forEach((v) => {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + 0.08);
    });
  }
  if (hard) stopAudio();
}

function tick() {
  if (!playState.playing || !audio) return;
  const t = audio.ac.currentTime - playState.startedAt;
  const p = clamp(t / playState.duration, 0, 1);
  const rect = ui.canvas.getBoundingClientRect();
  const parent = ui.canvas.parentElement.getBoundingClientRect();
  const dir = playState.dir;
  const reverse = dir === "rl" || dir === "bt";
  const prog = reverse ? 1 - p : p;
  if (dir === "lr" || dir === "rl") {
    const offsetX = rect.left - parent.left;
    ui.scan.style.transform = `translateX(${offsetX + prog * rect.width}px)`;
  } else {
    const offsetY = rect.top - parent.top;
    ui.scan.style.transform = `translateY(${offsetY + prog * rect.height}px)`;
  }
  ui.now.textContent = `${t.toFixed(1)} / ${playState.duration.toFixed(1)} s`;
  playState.raf = requestAnimationFrame(tick);
}

// ---------- Pitch mapping ----------

function pitchFromHue(h, baseFreq, octaves, scale) {
  if (!scale) {
    // continuous
    return baseFreq * Math.pow(2, h * octaves);
  }
  // total available pitches across the requested octaves
  const total = Math.max(1, Math.round(scale.length * octaves));
  const idx = Math.min(total - 1, Math.floor(h * total));
  const oct = Math.floor(idx / scale.length);
  const step = scale[idx % scale.length];
  return baseFreq * Math.pow(2, oct + step / 12);
}

// ---------- utils ----------

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function clampInt(x, lo, hi) { return Math.round(clamp(x, lo, hi)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Keep the scan line aligned on resize.
window.addEventListener("resize", () => {
  if (playState.playing) tick();
});

// ---------- PWA install ----------

const installPanel = $("installPanel");
const installBtn = $("installBtn");
const installClose = $("installClose");
const installHint = $("installHint");
const iosHelp = $("iosHelp");
const iosHelpClose = $("iosHelpClose");

const standaloneMql = window.matchMedia("(display-mode: standalone)");
const isStandalone = () =>
  standaloneMql.matches || window.navigator.standalone === true;
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
const DISMISS_KEY = "c2s-install-dismissed";

let deferredInstall = null;

function showInstallPanel({ ios = false } = {}) {
  if (isStandalone()) return;
  if (localStorage.getItem(DISMISS_KEY) === "1") return;
  installHint.textContent = ios
    ? 'Tap the share icon, then "Add to Home Screen".'
    : "Add it to your home screen for one-tap access.";
  installBtn.textContent = ios ? "Show me how" : "Install";
  installPanel.hidden = false;
}

function hideInstallPanel() {
  installPanel.hidden = true;
}

// If the app gets installed mid-session (display-mode flips to standalone),
// hide the banner right away.
standaloneMql.addEventListener?.("change", (e) => {
  if (e.matches) {
    hideInstallPanel();
    localStorage.setItem(DISMISS_KEY, "1");
  }
});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (!isStandalone()) showInstallPanel();
});

window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  hideInstallPanel();
  localStorage.setItem(DISMISS_KEY, "1");
});

installBtn.addEventListener("click", async () => {
  if (deferredInstall) {
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch {}
    deferredInstall = null;
    hideInstallPanel();
  } else if (IS_IOS) {
    iosHelp.hidden = false;
  } else {
    iosHelp.hidden = false;
  }
});

installClose.addEventListener("click", () => {
  hideInstallPanel();
  localStorage.setItem(DISMISS_KEY, "1");
});

iosHelpClose.addEventListener("click", () => {
  iosHelp.hidden = true;
  // User has seen the install steps — stop nagging them on future loads.
  hideInstallPanel();
  localStorage.setItem(DISMISS_KEY, "1");
});

iosHelp.addEventListener("click", (e) => {
  if (e.target === iosHelp) iosHelp.hidden = true;
});

if (!isStandalone() && IS_IOS) showInstallPanel({ ios: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
