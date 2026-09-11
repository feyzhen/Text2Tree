# Text2Tree

**Turn indented text or Markdown lists into a clean directory tree — right in your browser.**

**English** · [简体中文](README.zh-CN.md)

![No build step](https://img.shields.io/badge/build-none-2ea44f)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-blue)
![Runs offline](https://img.shields.io/badge/data-stays%20local-8957e5)
![MIT License](https://img.shields.io/badge/license-MIT-blue)

Paste a directory listing, an indented outline or a Markdown bullet list on the left, and Text2Tree renders a proper tree with `├──`, `└──` and `│` connectors on the right. Nesting is decided by leading spaces, the UI works in English or Chinese, and nothing is ever uploaded — there is no backend at all.

---

## Features

- **Live preview** — the tree is regenerated as you type, no manual trigger.
- **Collapsible branches** — click a node name to collapse / expand it, or focus it with `Tab` and press `Enter` / `Space`; plus "Collapse All" / "Expand All".
- **Copy as text** — copies exactly what you see, tree connectors included.
- **An editor made for outlines** — `Tab` / `Shift+Tab` indent or outdent whole lines (multi-line selections included), `Enter` / `Shift+Enter` inherits the current indentation and bullet, `Shift+Backspace` clears a line back to the start of its content.
- **Five indent styles, converted for you** — `2 spaces`, `4 spaces`, `*`, `-` or `+`; switching styles rewrites the existing content automatically (see [Rules](#rules)).
- **Input history** — the last 20 inputs are remembered locally; hover an entry in the *History* dropdown to preview it, click to restore it.
- **Bilingual UI** — switch between English and 中文 with the button in the header; the choice is remembered.
- **Light / dark theme** — one click in the header, follows your system preference until you choose.
- **Zero dependencies, no build step** — plain HTML, CSS and JavaScript. Everything (theme, language, history) is stored in `localStorage`.

## Quick start

```bash
git clone https://github.com/feyzhen/Text2Tree.git
cd Text2Tree
```

Then either open `index.html` directly in a browser, or serve the folder:

```bash
# Python
python -m http.server 8899

# or Node
node serve-local.mjs
```

Then visit `http://localhost:8899`. The bundled Node server listens on `127.0.0.1` only; start it with `HOST=0.0.0.0` to reach it from a phone on the same network (it prints the LAN URLs), and use `PORT` to change the port (`8899` by default).

Deployment is just as simple: this is a static site, so any static host (GitHub Pages, Netlify, Cloudflare Pages, an object-storage bucket…) works — upload the files and you are done.

## Usage

### Input

Type or paste text into the **Input** panel. Empty lines are ignored, and lines are trimmed before they become nodes.

```text
react-app
  config/webpack.config.js/version.js
  pages
    home
    app
    help
      contact.js
      mail.js
  package.json
```

…renders as:

```text
react-app
├── config
│   ├── webpack.config.js
│   └── version.js
├── pages
│   ├── home
│   ├── app
│   └── help
│       ├── contact.js
│       └── mail.js
└── package.json
```

The same input with the `*` indent style:

```text
* react-app
  * config/webpack.config.js/version.js
  * pages
    * home
  * package.json
```

### Rules

1. **Indentation defines nesting.** Equal indentation means siblings, and a level may only grow one step at a time (a deeper jump is clamped to the deepest available parent).
2. **Indent styles.** Choose `2 spaces`, `4 spaces`, `*`, `-` or `+` in the toolbar. Markdown markers are stripped during parsing and never count as a level; they are re-added when you switch to a marker style.
3. **`/` expands siblings.** Segments separated by `/` (or `\`) become siblings: the first segment is the current node, the rest are its sibling children. Trailing separators such as `src/` are ignored. Write deeper levels on separate lines.

### Shortcuts

| Keys | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Indent / outdent the whole line (also works on a multi-line selection) |
| `Enter` / `Shift+Enter` | New line inherits the current indentation and bullet marker (splitting mid-line keeps the level) |
| `Shift+Backspace` | Delete from the caret back to the start of the content, keeping indentation and marker; on a line without content, delete the line and move to the end of the previous one |
| `Backspace` | At the start of an indented line, remove one full indent unit (or outdent the whole line in a marker style) |
| `Space` | Typed in the indent area, inserts one indent unit instead of a literal space |
| `Ctrl / Cmd + Enter` | Generate the tree immediately |
| `Esc` | Close the history dropdown and restore the previewed input |
| `Tab`, then `Enter` / `Space` | In the preview, move focus to a folder node and collapse / expand it |

### Header controls

| Control | What it does |
| --- | --- |
| ☾ / ☀ | Toggle the light / dark theme (remembered in `localStorage` key `t2t-theme`) |
| 中文 / EN | Switch the interface language (remembered in `t2t-lang`); defaults to your browser language, falling back to English |
| GitHub icon | Open the repository |

### Input history

The **History** button in the Input panel header lists the most recent inputs (up to 20, newest first, deduplicated by text plus indent style).

- Hover (or keyboard-focus) an entry to preview it: the editor and the tree update immediately, and the content is restored as soon as the pointer leaves.
- Each entry carries a badge showing the indent style it was written in. Restoring converts the text to your **current** indent style, so the tree stays correct even if you switched styles in between.
- Click an entry to restore it for real — it is also moved back to the top of the list.
- Use **Clear** in the dropdown header to forget everything.
- An input is recorded when the editor loses focus, when you press `Ctrl`+`Enter`, or when you load the sample. Everything is stored in `localStorage` under `t2t-history`.

## Project structure

```text
Text2Tree/
├─ index.html        # Markup, share / SEO meta, i18n attributes, theme & language bootstrap
├─ style.css         # Design tokens (light + dark) and layout
├─ i18n.js           # UI strings (en / zh), loaded before app.js
├─ tree-core.js      # Pure logic core: parsing, tree rendering, indent conversion (UMD: browser + Node)
├─ app.js            # Interaction layer: editor behaviour, indent styles, theme, i18n, history
├─ favicon.svg       # Site icon
├─ serve-local.mjs   # Optional local static server
├─ README.md         # This file (English)
├─ README.zh-CN.md   # 简体中文说明
└─ LICENSE           # MIT
```

### Development notes

- `tree-core.js` is framework-free and has no DOM access, so it can be reused from Node (`require("./tree-core.js")`) or bundled elsewhere.
- There is no build step and no package manager requirement — edit the files and reload.
- **i18n**: static strings live in the HTML as `data-i18n` / `data-i18n-html` / `data-i18n-title` / `data-i18n-placeholder` / `data-i18n-aria` attributes; dynamic strings live in the `en` / `zh` dictionaries in `i18n.js`. Adding a language means adding one dictionary object and one button option.
- `localStorage` keys: `t2t-theme`, `t2t-lang`, `t2t-history`, `t2t-draft`. Clearing them resets the app to its defaults.

## License

Released under the [MIT License](LICENSE). You are free to use, modify, distribute and even sell this project, as long as the copyright notice and this license text are kept.

```text
Copyright (c) 2026 feyzhen
```
