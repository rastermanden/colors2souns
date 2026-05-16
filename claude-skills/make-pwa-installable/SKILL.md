---
name: make-pwa-installable
description: Turn a static web project into an installable PWA with a custom app icon. Use when the user asks to "make it installable", "add to home screen", "PWA setup", "save as app", or wants an iOS-style install banner and a Bosse-style home-screen icon. Asks the user for the source image and the app name, then generates icons, manifest, service worker, head tags, and an install banner with iOS Add-to-Home-Screen instructions.
---

# make-pwa-installable

Turn a static web project (anything with an `index.html`) into an installable PWA. Generates icons from a user-supplied image, writes the manifest and service worker, adds Apple/Android meta tags, and wires up an install banner with platform-aware behavior.

## Inputs to ask the user for

Use `AskUserQuestion` (or plain prompts) up-front. Don't make these guesses — ask, with sensible defaults shown.

1. **Source image** (required). Absolute path to a PNG/JPG to use as the icon. Wide images are fine — the script center-crops to a square; offer to let the user nudge the crop center if the subject is off-center.
2. **App name** — full name shown on the install prompt.
3. **Short name** — home-screen label, optional; defaults to the first ≤12 chars of the app name.
4. **Theme & background colors** — default `#0b0b10` for both unless the project already has a `theme-color` meta tag, in which case use that.
5. **Where index.html lives** — usually repo root; check before assuming.

## Steps

1. **Verify project shape.** Confirm `index.html` exists and is editable. If the project has a build step (Next, Vite, etc.) stop and tell the user — this skill targets plain static sites. (Frameworks need their own PWA plugin.)

2. **Generate icons.** Run `scripts/make-icons.mjs`:
   ```sh
   node "$SKILL_DIR/scripts/make-icons.mjs" \
     --src "<source-image>" \
     --out "<project>/icons" \
     [--crop-x 0.65]    # 0..1 horizontal center of crop (default 0.5)
     [--crop-y 0.5]     # 0..1 vertical center of crop (default 0.5)
     [--bg "#0b0b10"]   # background for the maskable safe-zone padding
   ```
   It installs `sharp` on demand into a private dir if not present, then writes `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180px). After it runs, preview `icon-192.png` with the Read tool and let the user redo the crop if needed.

3. **Write `manifest.webmanifest`** from `templates/manifest.webmanifest`. Substitute `{{NAME}}`, `{{SHORT_NAME}}`, `{{THEME}}`, `{{BG}}`. `start_url` and `scope` stay as `./` so it works under any GitHub Pages subpath.

4. **Write `sw.js`** from `templates/sw.js`. The shipped service worker is network-first for HTML/JS (so future fixes roll out) and cache-first for static assets. Update the `SHELL` list to match the actual asset paths in this project. Pick a cache name like `<short-slug>-v1`.

5. **Inject head tags** into `index.html` using the snippet in `templates/head-tags.html`. Don't duplicate existing `manifest`/`apple-touch-icon` tags; if there's already a `theme-color`, keep it.

6. **Inject install banner UI** below the page header:
   - HTML from `templates/install-panel.html`
   - CSS appended to the existing stylesheet (or `style.css` if none exists yet)
   - JS appended to the main script (or a new `install.js` loaded as a module)
   The JS file in `templates/install-panel.js` is self-contained. It uses a single localStorage key (`c2s-install-state`) — rename that prefix to match the project's slug to avoid clashes between sites.

7. **Register the service worker** at the end of the main JS:
   ```js
   if ("serviceWorker" in navigator) {
     window.addEventListener("load", () => {
       navigator.serviceWorker.register("./sw.js").catch(() => {});
     });
   }
   ```

8. **Add a cache-buster query** to the main script tag (`<script src="./app.js?v=1">`) and update the same path in `sw.js` SHELL. Tell the user to bump these together on future changes.

9. **Verify.** After writing files, list everything that landed (paths) and remind the user that GitHub Pages must be served over HTTPS for the install prompt to fire on Android Chrome. If they have a GitHub Pages deploy workflow, the new files (`manifest.webmanifest`, `sw.js`, `icons/*`) need to be checked in and pushed.

## Behaviour notes worth knowing

- The install banner is **platform-aware**:
  - **Android Chrome / Edge**: stores the deferred `beforeinstallprompt`, tap "Install" triggers the native dialog.
  - **iOS Safari**: shows immediately because there is no install API; tap "Show me how" opens a modal with Share → Add to Home Screen steps.
  - Other browsers (no BIP, not iOS): banner stays hidden — there's nothing useful we can do.
- State is tracked with three values in localStorage so the banner reappears after an uninstall:
  - `"installed"` — set on `appinstalled` or when display-mode flips to standalone. Cleared on the next BIP (which only fires when the app isn't installed).
  - `"dismissed"` — set when the user explicitly closes the banner.
  - unset — first run.
- CSS must include `.install-panel[hidden] { display: none }` or the banner will visibly persist because `display: flex` on the class overrides the UA `[hidden]` rule.

## Common adjustments

- **App is in a subdirectory** — leave manifest paths relative (`./icons/...`). Don't switch to absolute, it breaks under GitHub Pages.
- **Existing service worker** — merge: keep their fetch handler logic, but adopt the network-first treatment for HTML/JS so future updates aren't trapped in the cache.
- **User wants to skip the banner UI** — write the manifest and SW only; the meta tags still let the browser's native install affordance work.
