// Install banner controller. Append to the host page's main script.
// Rename the SLUG prefix on storage keys to avoid collisions between sites.
(() => {
  const $ = (id) => document.getElementById(id);
  const installPanel = $("installPanel");
  const installBtn = $("installBtn");
  const installClose = $("installClose");
  const installHint = $("installHint");
  const iosHelp = $("iosHelp");
  const iosHelpClose = $("iosHelpClose");
  if (!installPanel || !installBtn) return;

  const standaloneMql = window.matchMedia("(display-mode: standalone)");
  const isStandalone = () =>
    standaloneMql.matches || window.navigator.standalone === true;
  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;

  // Three-state record so the banner can return after an uninstall:
  //   "installed" — appinstalled fired or display-mode flipped to standalone
  //   "dismissed" — user tapped ✕ or finished the iOS instructions
  //   (unset)     — first run
  const STATE_KEY = "SLUG-install-state";
  const SCHEMA_KEY = "SLUG-install-schema";
  const SCHEMA_VERSION = 1;
  if (Number(localStorage.getItem(SCHEMA_KEY) || 0) < SCHEMA_VERSION) {
    localStorage.removeItem(STATE_KEY);
    localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
  }
  const getState = () => localStorage.getItem(STATE_KEY);
  const setState = (s) => localStorage.setItem(STATE_KEY, s);
  const clearState = () => localStorage.removeItem(STATE_KEY);

  let deferredInstall = null;

  function renderInstallPanel(ios) {
    installHint.textContent = ios
      ? 'Tap the share icon, then "Add to Home Screen".'
      : "Add it to your home screen for one-tap access.";
    installBtn.textContent = ios ? "Show me how" : "Install";
    installPanel.hidden = false;
  }
  function hideInstallPanel() { installPanel.hidden = true; }

  standaloneMql.addEventListener?.("change", (e) => {
    if (e.matches) {
      hideInstallPanel();
      setState("installed");
    }
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (isStandalone()) return;
    // BIP only fires when the app isn't installed. If we previously thought
    // it was installed, the user uninstalled — clear and reshow.
    if (getState() === "installed") clearState();
    if (getState() === "dismissed") return;
    renderInstallPanel(false);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    hideInstallPanel();
    setState("installed");
  });

  installBtn.addEventListener("click", async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch {}
      deferredInstall = null;
      hideInstallPanel();
      return;
    }
    if (IS_IOS) {
      iosHelp.hidden = false;
      return;
    }
    hideInstallPanel();
    setState("dismissed");
  });

  installClose.addEventListener("click", () => {
    hideInstallPanel();
    setState("dismissed");
  });

  iosHelpClose?.addEventListener("click", () => {
    iosHelp.hidden = true;
    hideInstallPanel();
    setState("dismissed");
  });
  iosHelp?.addEventListener("click", (e) => {
    if (e.target === iosHelp) iosHelp.hidden = true;
  });

  if (!isStandalone() && IS_IOS && getState() !== "dismissed") {
    renderInstallPanel(true);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
