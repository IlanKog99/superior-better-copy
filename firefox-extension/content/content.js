"use strict";

/*
 * Superior Better Copy — content script
 *
 * Flow: the popup sends { text, opts } where opts = { enter, selectAll }.
 * The user then clicks a target through a crosshair overlay that shields the
 * page from the click. We resolve what's under the pointer (descending into
 * same-origin iframes, e.g. the Proxmox console) and type into it.
 *
 * Two engines, chosen by target:
 *   a) Text fields / contenteditable -> deterministic value insertion. Synthetic
 *      key events don't mutate input values, so we write the value directly.
 *      That's what makes normal fields 100% accurate. Always one instant write.
 *   b) Canvas consoles (noVNC / VM consoles) -> no value to write; the console
 *      only understands keyboard events, which it relays to the VM. We send a
 *      precise key sequence per character (correct key/code + held Shift for
 *      capitals & symbols). US-QWERTY layout assumed.
 *
 * Optional actions (both engines):
 *   - selectAll: send Ctrl+A first (select existing content so typing overwrites)
 *   - enter: press Enter "before" / "after" / "both" / "none" the text
 *
 * Single line only: the popup strips newlines, so text is always one line.
 */

(() => {
  if (window.__sbcInjected) return;
  window.__sbcInjected = true;

  let pending = null; // { text, opts }
  let overlay = null;
  let picking = false;
  let busy = false;

  browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "SBC_START_PICK") {
      pending = { text: msg.text || "", opts: msg.opts || {} };
      startPick();
    }
  });

  // ---------------------------------------------------------------- selection
  function startPick() {
    if (picking || busy) return;
    picking = true;

    overlay = document.createElement("div");
    overlay.className = "sbc-overlay";

    const hint = document.createElement("div");
    hint.className = "sbc-hint";
    hint.innerHTML =
      '<span class="sbc-dot"></span> Click a text field or VM console to type into it' +
      '<span class="sbc-kbd">Esc to cancel</span>';
    overlay.appendChild(hint);

    document.documentElement.appendChild(overlay);

    overlay.addEventListener("click", onPick, true);
    overlay.addEventListener("mousedown", swallow, true);
    overlay.addEventListener("mouseup", swallow, true);
    overlay.addEventListener("contextmenu", swallow, true);
    overlay.addEventListener("auxclick", swallow, true);
    document.addEventListener("keydown", onPickKey, true);
  }

  function swallow(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onPickKey(e) {
    if (e.key === "Escape") {
      swallow(e);
      endPick();
      toast("Cancelled", "warn");
    }
  }

  function endPick() {
    picking = false;
    document.removeEventListener("keydown", onPickKey, true);
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  function onPick(e) {
    e.preventDefault();
    e.stopPropagation();

    overlay.style.display = "none";
    const target = resolveTarget(e.clientX, e.clientY);
    overlay.style.display = "";

    if (!target) {
      toast("That's not typable — click an input, editor, or VM console.", "warn");
      return; // stay in selection mode for another try
    }
    if (target.type === "x-origin") {
      endPick();
      toast("That console is on another domain — Firefox blocks typing into it.", "warn");
      return;
    }

    endPick();

    if (target.type === "console") {
      try { target.el.focus(); } catch (_) {}
      runConsole(target, pending.text, pending.opts);
    } else {
      placeCaret(target.el, target.caret);
      runField(target, pending.text, pending.opts);
    }
  }

  // ---------------------------------------------------- target resolution
  function resolveTarget(x, y) {
    let doc = document;
    let cx = x;
    let cy = y;

    for (let depth = 0; depth < 5; depth++) {
      const el = doc.elementFromPoint(cx, cy);
      if (!el) return null;

      if (isConsoleCanvas(el)) return { type: "console", el, doc };

      if (el.tagName === "IFRAME") {
        let innerDoc = null;
        try { innerDoc = el.contentDocument; } catch (_) { innerDoc = null; }
        if (!innerDoc) return { type: "x-origin" };
        const r = el.getBoundingClientRect();
        cx = cx - r.left - (el.clientLeft || 0);
        cy = cy - r.top - (el.clientTop || 0);
        doc = innerDoc;
        continue;
      }

      const ed = findEditable(el);
      if (ed) {
        const caret = doc.caretPositionFromPoint
          ? doc.caretPositionFromPoint(cx, cy)
          : null;
        const kind = ed.tagName === "INPUT" || ed.tagName === "TEXTAREA" ? "field" : "ce";
        return { type: kind, el: ed, doc, caret };
      }
      return null;
    }
    return null;
  }

  function isConsoleCanvas(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === "CANVAS") return true;
    const id = (el.id || "").toLowerCase();
    const cls = (el.className && el.className.toString ? el.className.toString() : "").toLowerCase();
    return /novnc|vnc|spice|console/.test(id) || /novnc|vnc|spice/.test(cls);
  }

  // ----------------------------------------------------------- element lookup
  const TEXT_INPUT_TYPES = new Set([
    "text", "search", "url", "tel", "email", "password", "number", "",
  ]);

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled || el.readOnly) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") return TEXT_INPUT_TYPES.has((el.type || "").toLowerCase());
    if (el.isContentEditable) return true;
    return false;
  }

  function findEditable(el) {
    let node = el;
    for (let i = 0; node && i < 8; i++) {
      if (isEditable(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function placeCaret(target, caret) {
    try { target.focus({ preventScroll: false }); }
    catch (_) { try { target.focus(); } catch (_) {} }

    const isField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    const win = target.ownerDocument.defaultView;

    if (isField) {
      let pos = null;
      if (caret && caret.offsetNode === target && typeof caret.offset === "number") {
        pos = caret.offset;
      }
      if (pos == null) pos = target.value.length;
      try {
        const clamped = Math.max(0, Math.min(pos, target.value.length));
        target.selectionStart = target.selectionEnd = clamped;
      } catch (_) {}
      return;
    }

    try {
      const sel = win.getSelection();
      if (caret && caret.offsetNode && target.contains(caret.offsetNode)) {
        sel.collapse(caret.offsetNode, caret.offset);
      }
    } catch (_) {}
  }

  function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  // ============================================================ FIELD ENGINE
  function setNativeValue(el, value) {
    const win = el.ownerDocument.defaultView;
    const proto =
      el.tagName === "TEXTAREA"
        ? win.HTMLTextAreaElement.prototype
        : win.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  function fieldEnter(el) {
    // Fields have no "newline" semantics for single-line input; dispatch a real
    // Enter key sequence so form/keydown handlers (search boxes, chats) submit.
    const win = el.ownerDocument.defaultView;
    const info = { key: "Enter", code: "Enter", keyCode: 13 };
    for (const type of ["keydown", "keypress", "keyup"]) {
      el.dispatchEvent(new win.KeyboardEvent(type, {
        key: info.key, code: info.code, keyCode: info.keyCode, which: info.keyCode,
        bubbles: true, cancelable: true, composed: true, view: win,
      }));
    }
  }

  async function runField(target, text, opts) {
    if (busy) return;
    busy = true;

    const el = target.el;
    const win = el.ownerDocument.defaultView;
    const isField = el.tagName === "INPUT" || el.tagName === "TEXTAREA";

    try {
      if (opts.selectAll) {
        if (isField) { try { el.select(); } catch (_) {} }
        else { try { el.ownerDocument.execCommand("selectAll"); } catch (_) {} }
      }

      if (opts.enter === "before" || opts.enter === "both") fieldEnter(el);

      if (text.length) {
        if (isField) {
          // One deterministic write — replaces the current selection (so
          // "select all" overwrites) and is exact by construction.
          const hasSel = el.selectionStart != null && el.selectionStart !== el.selectionEnd;
          const start = el.selectionStart != null ? el.selectionStart : el.value.length;
          const end = el.selectionEnd != null ? el.selectionEnd : start;
          const v = el.value;
          const next = hasSel || opts.selectAll
            ? v.slice(0, start) + text + v.slice(end)
            : v.slice(0, start) + text + v.slice(start);
          setNativeValue(el, next);
          const pos = start + text.length;
          try { el.selectionStart = el.selectionEnd = pos; } catch (_) {}
          el.dispatchEvent(new win.InputEvent("input", {
            bubbles: true, cancelable: false, inputType: "insertFromPaste", data: text,
          }));
        } else {
          let ok = false;
          try { ok = el.ownerDocument.execCommand("insertText", false, text); } catch (_) {}
          if (!ok) {
            try {
              const sel = win.getSelection();
              if (sel && sel.rangeCount) {
                const r = sel.getRangeAt(0);
                r.deleteContents();
                r.insertNode(el.ownerDocument.createTextNode(text));
                sel.collapseToEnd();
              }
            } catch (_) {}
          }
          el.dispatchEvent(new win.InputEvent("input", {
            bubbles: true, cancelable: false, inputType: "insertFromPaste", data: text,
          }));
        }
      }

      if (opts.enter === "after" || opts.enter === "both") fieldEnter(el);
    } finally {
      busy = false;
    }

    toast(`Done — typed ${text.length} character${text.length === 1 ? "" : "s"}.`, "ok");
  }

  // ========================================================== CONSOLE ENGINE
  // US-QWERTY character -> physical key descriptor.
  const SYMBOLS = {
    "`": ["Backquote", 192, false], "~": ["Backquote", 192, true],
    "-": ["Minus", 189, false],     "_": ["Minus", 189, true],
    "=": ["Equal", 187, false],     "+": ["Equal", 187, true],
    "[": ["BracketLeft", 219, false],  "{": ["BracketLeft", 219, true],
    "]": ["BracketRight", 221, false], "}": ["BracketRight", 221, true],
    "\\": ["Backslash", 220, false],   "|": ["Backslash", 220, true],
    ";": ["Semicolon", 186, false],    ":": ["Semicolon", 186, true],
    "'": ["Quote", 222, false],        "\"": ["Quote", 222, true],
    ",": ["Comma", 188, false],        "<": ["Comma", 188, true],
    ".": ["Period", 190, false],       ">": ["Period", 190, true],
    "/": ["Slash", 191, false],        "?": ["Slash", 191, true],
    "!": ["Digit1", 49, true], "@": ["Digit2", 50, true], "#": ["Digit3", 51, true],
    "$": ["Digit4", 52, true], "%": ["Digit5", 53, true], "^": ["Digit6", 54, true],
    "&": ["Digit7", 55, true], "*": ["Digit8", 56, true], "(": ["Digit9", 57, true],
    ")": ["Digit0", 48, true],
  };

  function charToKey(ch) {
    if (ch === "\t") return { key: "Tab", code: "Tab", keyCode: 9, shift: false };
    if (ch === " ")  return { key: " ", code: "Space", keyCode: 32, shift: false };
    if (ch >= "a" && ch <= "z")
      return { key: ch, code: "Key" + ch.toUpperCase(), keyCode: ch.toUpperCase().charCodeAt(0), shift: false };
    if (ch >= "A" && ch <= "Z")
      return { key: ch, code: "Key" + ch, keyCode: ch.charCodeAt(0), shift: true };
    if (ch >= "0" && ch <= "9")
      return { key: ch, code: "Digit" + ch, keyCode: ch.charCodeAt(0), shift: false };
    const s = SYMBOLS[ch];
    if (s) return { key: ch, code: s[0], keyCode: s[1], shift: s[2] };
    return { key: ch, code: "", keyCode: 0, shift: false };
  }

  const SHIFT = { key: "Shift", code: "ShiftLeft", keyCode: 16 };
  const CTRL = { key: "Control", code: "ControlLeft", keyCode: 17 };
  const ENTER = { key: "Enter", code: "Enter", keyCode: 13 };

  function fireKey(el, win, type, info, mods) {
    el.dispatchEvent(new win.KeyboardEvent(type, {
      key: info.key,
      code: info.code,
      keyCode: info.keyCode,
      which: info.keyCode,
      charCode: type === "keypress" ? info.keyCode : 0,
      shiftKey: !!(mods && mods.shift),
      ctrlKey: !!(mods && mods.ctrl),
      bubbles: true,
      cancelable: true,
      composed: true,
      view: win,
    }));
  }

  // Spacing between *individual* key events. Short lines only now, so we can
  // afford a comfortable gap that never overruns the VM keyboard pipeline —
  // accuracy first. (~8ms/event ≈ 60+ chars/sec, plenty for a word or a line.)
  const GAP = 8;

  async function consoleTap(el, win, info, mods) {
    fireKey(el, win, "keydown", info, mods);
    await sleep(GAP);
    fireKey(el, win, "keyup", info, mods);
    await sleep(GAP);
  }

  async function consoleEnter(el, win) {
    await consoleTap(el, win, ENTER, null);
  }

  async function consoleSelectAll(el, win) {
    fireKey(el, win, "keydown", CTRL, { ctrl: true });
    await sleep(GAP);
    fireKey(el, win, "keydown", { key: "a", code: "KeyA", keyCode: 65 }, { ctrl: true });
    await sleep(GAP);
    fireKey(el, win, "keyup", { key: "a", code: "KeyA", keyCode: 65 }, { ctrl: true });
    await sleep(GAP);
    fireKey(el, win, "keyup", CTRL, null);
    await sleep(GAP);
  }

  async function runConsole(target, text, opts) {
    if (busy) return;
    busy = true;

    const el = target.el;
    const win = target.doc.defaultView;

    // Single line: ignore any stray newlines.
    const chars = [];
    for (const ch of text) if (ch !== "\n" && ch !== "\r") chars.push(ch);

    let shiftDown = false;
    let sent = 0;
    try {
      if (opts.selectAll) await consoleSelectAll(el, win);
      if (opts.enter === "before" || opts.enter === "both") await consoleEnter(el, win);

      for (let i = 0; i < chars.length; i++) {
        const info = charToKey(chars[i]);

        // Hold Shift as tracked state across a run of shifted chars (pressing/
        // releasing it once per run), never toggling it per character — that
        // thrash is what desynced the modifier before.
        if (info.shift && !shiftDown) {
          fireKey(el, win, "keydown", SHIFT, { shift: true });
          shiftDown = true;
          await sleep(GAP);
        } else if (!info.shift && shiftDown) {
          fireKey(el, win, "keyup", SHIFT, null);
          shiftDown = false;
          await sleep(GAP);
        }

        const mods = shiftDown ? { shift: true } : null;
        fireKey(el, win, "keydown", info, mods);
        await sleep(GAP);
        fireKey(el, win, "keyup", info, mods);
        await sleep(GAP);
        sent++;
      }

      // Release Shift before the trailing Enter so Enter is unmodified.
      if (shiftDown) {
        fireKey(el, win, "keyup", SHIFT, null);
        shiftDown = false;
        await sleep(GAP);
      }

      if (opts.enter === "after" || opts.enter === "both") await consoleEnter(el, win);
    } finally {
      if (shiftDown) { try { fireKey(el, win, "keyup", SHIFT, null); } catch (_) {} }
      busy = false;
    }

    toast(`Done — sent ${sent} keystroke${sent === 1 ? "" : "s"} to console.`, "ok");
  }

  // -------------------------------------------------------------------- toast
  let toastEl = null;
  let toastTimer = null;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "sbc-toast";
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = "sbc-toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.className = "sbc-toast"; }, 2600);
  }
})();
