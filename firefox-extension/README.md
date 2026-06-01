# Superior Better Copy — Web Typer (Firefox extension)

A browser port of the Superior Better Copy desktop tool. Instead of typing into any
OS application, it types into **text fields and VM consoles on the current web page** —
accurately. The primary use is the **Proxmox noVNC console**, where you can't paste.

Scope is deliberately tight: **a single word or line**, typed at **max speed**. Multi-line
scripts, macros, hotkeys, and profiles are out of scope.

## What it does

1. Click the toolbar icon to open the menu.
2. Type or paste a **word or single line** (newlines are stripped automatically), or click
   **Fill from clipboard** to drop the last copied text into the box.
3. (Optional) Choose **Press Enter** — None / Before / After / Both.
4. (Optional) Turn on **Select all first (Ctrl + A)** to overwrite existing content.
5. Click **Pick a target & type**. Your cursor becomes a crosshair.
6. Click any text field or VM console. While the crosshair is active, clicks do **not**
   trigger the page — they only choose the target. Press **Esc** to cancel.
7. The extension types your text into that target instantly.

**Fill from clipboard & Auto-start:** the **Fill from clipboard** button pastes the latest
clipboard text into the box (collapsed to one line). With **Auto-start after fill** ticked,
filling immediately kicks off step 5 — so you can copy a command, open the popup, click
Fill, and go straight to picking the target.

**Privacy:** the text to type is **never saved** — the box always opens empty. Only your
settings (Press Enter, Select all, Auto-start) are remembered.

## The two actions

- **Press Enter** — sends an Enter keystroke around the text. Useful to auto-run a command
  after pasting (*After*), submit one input then another (*Both* lets you e.g. Enter →
  type a code → Enter), or confirm a prompt before typing (*Before*).
- **Select all first** — sends **Ctrl + A** before typing so the new text overwrites
  whatever's already there (e.g. replacing a file's contents in one shot).

## Two typing engines (picked automatically)

The extension detects what you clicked and uses the right strategy:

### 1. Text fields & editors — *value insertion*
For `<input>`, `<textarea>`, and `contenteditable`, the #1 guarantee is that the text
lands **exactly** as written. It does **not** simulate keystrokes (synthetic
`KeyboardEvent`s are untrusted and don't insert characters into inputs). Instead it
inserts deterministically:

- `<input>` / `<textarea>`: writes through the native value setter (so React/Vue
  controlled inputs update) and dispatches a real `InputEvent`.
- `contenteditable` editors: `execCommand('insertText')` with a Range-based fallback.

Insertion is deterministic and done in **one write**, so it's exact by construction and
instant. The optional **Ctrl + A** / **Enter** actions map to `el.select()` and a real
Enter key sequence respectively.

> If a site applies its own input masking/maxlength, the field's final value reflects the
> site's rules — that's the page's behavior, not a typing error.

### 2. VM consoles (noVNC / Proxmox) — *key-event mode*
A VM console (e.g. the Proxmox **noVNC** KVM console) is a `<canvas>`, not a text field —
there's nothing to write a value into. The console only understands **keyboard events**,
which it forwards to the VM. So for canvas consoles the extension flips its strategy and
dispatches a precise key sequence per character:

- correct `key` **and** `code` (what noVNC reads to build the keysym),
- a real **Shift** press/release around capitals and shifted symbols (`!@#$…`), so the
  VM's keyboard gets the right modifier state,
- the optional **Ctrl + A** (select all) and **Enter** (before/after/both) actions as
  their own key sequences.

The Proxmox console runs in a **same-origin iframe**, so the picker descends into it
automatically — just click the console area as usual. Clicks are still shielded from the
page while the crosshair is active.

**Accuracy at speed:** a console can't be pasted into, so it's sent as keystrokes. Two
measures keep it exact:

- **Event flow control** — *every individual key event* is spaced by a small fixed gap
  (~8 ms), so events never burst out faster than the VM's keyboard pipeline can drain
  them. Bursting is what desyncs a console.
- **Held-Shift state** — Shift is pressed once for a run of capitals/symbols and released
  once (and always released at the end / before a trailing Enter), instead of toggling it
  around every character. Per-character Shift thrash is what made it "stick" and turn
  output into ALL-CAPS garbage; holding it as tracked state fixes that.

Because the scope is a word or a line, the comfortable 8 ms gap is still effectively
instant while staying rock-solid.

**Keyboard layout:** key mapping assumes **US QWERTY** (the default for Linux consoles and
the Proxmox web UI). Non-US layouts can mis-map some symbols; configurable layouts are a
later feature.

## Load it in Firefox (temporary install)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `firefox-extension/manifest.json`.
4. The crosshair icon appears in the toolbar. Pin it if you like.

Temporary add-ons are removed when Firefox restarts. To package for distribution later,
zip the contents of the `firefox-extension/` folder and submit to AMO, or use
`web-ext build`.

## Known limitations (core scope)

- **Same-origin** iframes only (this covers the Proxmox console). A console served from a
  different domain is blocked by the browser and will show a notice.
- Restricted pages (`about:`, `addons.mozilla.org`, the PDF viewer, etc.) can't be typed into.
- Single-line `<input>` elements ignore newlines, as the browser does normally.
- Console key mapping assumes US QWERTY; non-US layouts may mis-map some symbols.

## Files

```
firefox-extension/
├── manifest.json          MV3 manifest (Firefox / gecko settings)
├── icons/icon.svg         crosshair reticle icon
├── popup/                 the menu UI (html/css/js)
└── content/               selection mode + typing engine (js/css)
```
