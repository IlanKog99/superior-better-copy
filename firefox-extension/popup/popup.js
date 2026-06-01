"use strict";

const els = {
  text: document.getElementById("text"),
  autoStart: document.getElementById("autoStart"),
  fill: document.getElementById("fill"),
  enter: document.getElementById("enter"),
  selectAll: document.getElementById("selectAll"),
  pick: document.getElementById("pick"),
  status: document.getElementById("status"),
};

const STORE_KEY = "sbc_state";

// ---- persistence -----------------------------------------------------------
// Only the settings are persisted — never the text to type, by design. The text
// box always opens empty so secrets/commands aren't left on disk.
async function loadState() {
  try {
    const { [STORE_KEY]: s } = await browser.storage.local.get(STORE_KEY);
    if (!s) return;
    if (typeof s.enter === "string") els.enter.value = s.enter;
    if (typeof s.selectAll === "boolean") els.selectAll.checked = s.selectAll;
    if (typeof s.autoStart === "boolean") els.autoStart.checked = s.autoStart;
  } catch (_) {}
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    browser.storage.local.set({
      [STORE_KEY]: {
        enter: els.enter.value,
        selectAll: els.selectAll.checked,
        autoStart: els.autoStart.checked,
      },
    });
  }, 150);
}

function setStatus(msg, kind) {
  els.status.textContent = msg || "";
  els.status.className = "status" + (kind ? " " + kind : "");
}

// Single line only: strip any newlines that sneak in via paste. Text is not
// persisted, so no saveState() here.
els.text.addEventListener("input", () => {
  if (els.text.value.includes("\n") || els.text.value.includes("\r")) {
    els.text.value = els.text.value.replace(/[\r\n]+/g, " ");
  }
});
els.enter.addEventListener("change", saveState);
els.selectAll.addEventListener("change", saveState);
els.autoStart.addEventListener("change", saveState);

// Enter in the box triggers the action (it's a single-line field).
els.text.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); els.pick.click(); }
});

// ---- fill from clipboard ---------------------------------------------------
function toLine(s) {
  return (s || "").replace(/[\r\n]+/g, " ");
}

els.fill.addEventListener("click", async () => {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch (_) {
    setStatus("Couldn’t read the clipboard. Copy something, then try again.", "err");
    return;
  }
  if (!text) {
    setStatus("Clipboard is empty.", "err");
    return;
  }
  els.text.value = toLine(text);
  setStatus("Filled from clipboard.", "ok");
  els.text.focus();
  if (els.autoStart.checked) els.pick.click();
});

// ---- the action ------------------------------------------------------------
els.pick.addEventListener("click", async () => {
  const text = els.text.value;
  // Allow empty text when an action (select-all and/or Enter) is requested.
  const hasAction = els.selectAll.checked || els.enter.value !== "none";
  if (!text.length && !hasAction) {
    setStatus("Nothing to type — write a word or line first.", "err");
    els.text.focus();
    return;
  }

  const opts = {
    enter: els.enter.value,        // none | before | after | both
    selectAll: els.selectAll.checked,
  };

  const msg = { type: "SBC_START_PICK", text, opts };

  let tab;
  try {
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  } catch (_) {}

  if (!tab || !tab.id || /^(about:|moz-extension:|view-source:|resource:)/.test(tab.url || "")) {
    setStatus("This page can’t be typed into. Open a normal website and try again.", "err");
    return;
  }

  try {
    await browser.tabs.sendMessage(tab.id, msg);
    window.close();
    return;
  } catch (_) {
    // Content script not present yet — inject and retry.
  }

  try {
    await browser.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content/content.css"] });
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/content.js"] });
    await browser.tabs.sendMessage(tab.id, msg);
    window.close();
  } catch (e) {
    setStatus("Can’t run on this page (it may be a protected page).", "err");
  }
});

loadState();
