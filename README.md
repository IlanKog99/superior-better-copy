# Superior Better Copy

Automated text typing tools that "type for you" — useful anywhere you can't paste, like
**VM consoles** (Proxmox/noVNC), remote sessions, or apps that block paste.

This repo ships **two independent versions**:

| Version | Folder | Runs on | Best for |
|---|---|---|---|
| 🐍 **Python desktop app** | [`python-script/`](python-script/) | Windows (any app on your PC) | Typing into **any desktop application**, long text, macros & special keys |
| 🦊 **Firefox extension** | [`firefox-extension/`](firefox-extension/) | Firefox (web pages & web consoles) | Quick, exact typing into a **web page field or in-browser VM console** |

They solve the same core problem in two different places — your **whole desktop** vs.
**inside the browser**. Pick whichever matches where you need the text to land.

---

## 🐍 Python desktop app (`python-script/`)

A Windows app that types text into **any application** on your computer via simulated
keystrokes. This is the original, full-featured version.

### Features
- **Automated typing** into any desktop app, with customizable speed
- **Special commands** in `[brackets]` for keys/actions (see below)
- **Clipboard integration** — start typing straight from clipboard contents
- **Global hotkeys** — `Ctrl+F7` / `Ctrl+Shift+F7` work even when the app isn't focused
- **Start delay** before typing begins, and **multi-monitor** toast notifications
- **Ignore mode** — type brackets as literal text instead of commands

### Special commands
Use these inside square brackets within your text:

| Command | Action |
|---|---|
| `[backspace]` | Press Backspace |
| `[enter]` | Press Enter |
| `[arrow up/left/right/down]` | Press an arrow key |
| `[delay 2.5]` | Wait 2.5 seconds |
| `[ctrl+c]` | Press Ctrl+C |
| `[shift+tab]` | Press Shift+Tab |
| `[tab]` | Press Tab |

### Install & run
```powershell
cd python-script
pip install -r requirements.txt
pythonw "Superior Better Copy.pyw"
```
> The `.pyw` extension runs the app with `pythonw` so **no terminal window** appears.
> You can also just double-click `Superior Better Copy.pyw`.

### Hotkeys
- **Ctrl+F7** — start typing from clipboard content
- **Ctrl+Shift+F7** — start typing immediately from clipboard (no delay)

### Requirements
- Windows 10/11, Python 3.7+
- Dependencies (in `requirements.txt`): `customtkinter`, `pyautogui`, `pyperclip`,
  `keyboard`, `pywin32`

---

## 🦊 Firefox extension (`firefox-extension/`)

A focused browser port. Open the toolbar menu, type or paste **a word or a single line**,
then click a target on the page through a crosshair — the extension types it in for you,
**100% accurately**, instantly. Built primarily for the **Proxmox noVNC console**, where
pasting isn't possible.

### Features
- **Crosshair targeting** — click the button, then click any text field or VM console. While
  the crosshair is active, clicks **don't** trigger the page, they only pick the target.
- **Two typing engines, chosen automatically:**
  - *Text fields / editors* (`input`, `textarea`, `contenteditable`) — one deterministic
    value write, exact by construction (works with React/Vue controlled inputs).
  - *Canvas VM consoles* (noVNC) — sends precise key events the console relays to the VM,
    with correct `key`/`code` and held-Shift handling for capitals & symbols. Reaches into
    the Proxmox **same-origin iframe** automatically.
- **Press Enter** — None / Before / After / Both (e.g. auto-run a command after typing).
- **Select all first (Ctrl + A)** — overwrite existing content in one shot.
- **Fill from clipboard** button, with optional **Auto-start** to jump straight to picking.
- **Privacy:** the text to type is **never saved** — the box always opens empty; only
  settings are remembered.

### Install (temporary)
1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → select `firefox-extension/manifest.json`

See [`firefox-extension/README.md`](firefox-extension/README.md) for full details, the
accuracy design notes, and known limitations.

---

## Which one do I want?

- **Typing into a normal desktop program, or need macros / special keys / long text?**
  → Use the **Python desktop app**.
- **Typing into something inside Firefox — a web form or an in-browser VM console (Proxmox)?**
  → Use the **Firefox extension**.

## Feature comparison

| | Python desktop app | Firefox extension |
|---|---|---|
| Where it types | Any Windows application | Web page fields & in-browser consoles |
| Target selection | Active window / focused field | Click-to-pick crosshair |
| Text length | Any length | A word or a single line |
| Speed control | Customizable + start delay | Always instant |
| `[bracket]` macros & special keys | ✅ | ❌ (not yet) |
| Global hotkeys | ✅ | ❌ |
| Clipboard fill | ✅ (hotkey) | ✅ (button + auto-start) |
| Press Enter before/after | via `[enter]` | ✅ dropdown |
| Select-all / overwrite | via `[ctrl+a]` | ✅ toggle |
| noVNC / VM console support | OS-level (any console window) | ✅ native, in-browser |
| Saves typed text | — | ❌ by design (never persisted) |
| Platform | Windows | Firefox (any OS) |

---

## License
Open source under the [MIT License](LICENSE).

## Contributing
Contributions are welcome — feel free to open an issue or pull request.
