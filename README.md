# colors2souns

Turn an image into sound, right in the browser. Mobile-first. No build step.

Open the deployed page, upload an image (or snap one with **Use camera**),
and tweak the sliders to calibrate the image → sound mapping.

## How the mapping works

The image is downsampled to a working canvas, then split into a grid of
`density × voices` blocks. Each column is a moment in time; each row is one
synthesizer voice.

For every block we compute the average colour in HSL and map it to audio:

| Image property | Sound property |
| -------------- | -------------- |
| Hue            | Pitch (with optional musical-scale quantization) |
| Saturation     | Lowpass cutoff / brightness of the timbre |
| Lightness      | Volume of that voice |
| X position     | Time / playhead |
| Y band         | Which of the polyphonic voices |

Calibration sliders let you set the base frequency, pitch range in octaves,
scan duration, sample density, hue offset, scale, waveform, brightness and
saturation response, number of voices (vertical chord size), and master
volume.

Tap or drag on the preview to jump the playhead to that position — handy
for skipping to an interesting part of the image without restarting from
the beginning.

## Run locally

It's a static site:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Every push to `main` triggers `.github/workflows/deploy.yml`, which publishes
the repository root to GitHub Pages. Enable Pages once in repo settings:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
