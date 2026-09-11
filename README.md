# Text2Tree

**Turn indented text or Markdown lists into a clean directory tree — right in your browser.**

**English** · [简体中文](#简体中文)

![No build step](https://img.shields.io/badge/build-none-2ea44f)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-blue)
![Runs offline](https://img.shields.io/badge/data-stays%20local-8957e5)
![MIT License](https://img.shields.io/badge/license-MIT-blue)

Paste a directory listing, an indented outline or a Markdown bullet list on the left, and Text2Tree renders a proper tree with `├──`, `└──` and `│` connectors on the right. Nesting is decided by leading spaces, the UI works in English or Chinese, and nothing is ever uploaded — there is no backend at all.

---

## Features

- **Nesting from indentation** — the level of a line is decided solely by its leading spaces; the first line is the top level and levels may only increase one step at a time.
- **Five indent styles** — `2 spaces`, `4 spaces`, `*`, `-`, `+`. The last three are Markdown list styles: the marker is decorative and does **not** affect nesting. Switching styles converts the existing content automatically.
- **`/` sibling expansion** — write `config/webpack.config.js/version.js` on one line and the remaining segments are expanded as siblings of the first one.
- **Editor made for outlines** — `Tab` / `Shift+Tab` indent or outdent whole lines (multi-line selections included), `Enter` / `Shift+Enter` inherits the current indentation and bullet, `Shift+Backspace` clears a line back to the start of its content or removes an empty line.
- **Live preview** — the tree is regenerated while you type, with no manual trigger; collapse / expand by clicking a node name, "Collapse All" / "Expand All".
- **Copy as text** — copies exactly what you see, including the tree connectors.
- **Input history** — the last 20 inputs are remembered locally. Open the *History* dropdown, hover an entry to preview it in the editor, click to restore it.
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

Then visit `http://localhost:8899`.

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

### Header controls

| Control | What it does |
| --- | --- |
| ☾ / ☀ | Toggle the light / dark theme (remembered in `localStorage` key `t2t-theme`) |
| 中文 / EN | Switch the interface language (remembered in `t2t-lang`); defaults to your browser language, falling back to English |
| GitHub icon | Open the repository |

### Input history

The **History** button in the Input panel header lists the most recent inputs (up to 20, newest first, deduplicated).

- Hover (or keyboard-focus) an entry to preview it: the editor and the tree update immediately, and the content is restored as soon as the pointer leaves.
- Each entry carries a badge showing the indent style it was written in. Restoring converts the text to your **current** indent style, so the tree stays correct even if you switched styles in between.
- Click an entry to restore it for real — it is also moved back to the top of the list.
- Use **Clear** in the dropdown header to forget everything.
- An input is recorded when the editor loses focus, when you press `Ctrl`+`Enter`, or when you load the sample. Everything is stored in `localStorage` under `t2t-history`.

## Project structure

```text
Text2Tree/
├─ index.html       # Markup, i18n attributes and the theme / language bootstrap script
├─ style.css        # Design tokens (light + dark) and layout
├─ tree-core.js     # Pure logic core: parsing, tree rendering, indent conversion (UMD: browser + Node)
├─ app.js           # Interaction layer: editor behaviour, indent styles, theme, i18n, history
└─ serve-local.mjs  # Optional local static server
```

### Development notes

- `tree-core.js` is framework-free and has no DOM access, so it can be reused from Node (`require("./tree-core.js")`) or bundled elsewhere.
- There is no build step and no package manager requirement — edit the files and reload.
- **i18n**: static strings live in the HTML as `data-i18n` / `data-i18n-html` / `data-i18n-title` / `data-i18n-placeholder` / `data-i18n-aria` attributes; dynamic strings live in the `I18N` dictionary in `app.js`. Adding a language means adding one object and one button option.
- `localStorage` keys: `t2t-theme`, `t2t-lang`, `t2t-history`. Clearing them resets the app to its defaults.

## License

Released under the [MIT License](LICENSE). You are free to use, modify, distribute and even sell this project, as long as the copyright notice and this license text are kept.

```text
Copyright (c) 2026 feyzhen
```

---
---

# 简体中文

**[English](#text2tree)** · 简体中文

**在浏览器里把「缩进文本 / Markdown 列表」一键变成目录树。**

![无需构建](https://img.shields.io/badge/build-none-2ea44f)
![零依赖](https://img.shields.io/badge/dependencies-0-blue)
![纯本地](https://img.shields.io/badge/data-stays%20local-8957e5)
![MIT 许可证](https://img.shields.io/badge/license-MIT-blue)

把目录清单、缩进大纲或 Markdown 无序列表粘贴到左侧，右侧立刻生成带 `├──`、`└──`、`│` 连接线的目录树。层级只由行首空格决定，界面支持中英文，**纯前端、无后端**，所有数据都只在浏览器本地处理。

---

## 功能特性

- **缩进定层级**：层级一律由**行首空格**决定，首行为顶层，只能逐级递增、不能越级。
- **五种缩进样式**：`2 空格`、`4 空格`、`*`、`-`、`+`。后三者是 Markdown 列表写法，符号仅装饰、**不参与分层**；切换样式时已输入内容自动换算。
- **`/` 同级展开**：`config/webpack.config.js/version.js` 写在一行，除首段外的其余段自动展开为同级子节点。
- **为大纲优化的编辑体验**：`Tab` / `Shift+Tab` 整行增减一级（多行选区同时生效）；`Enter` / `Shift+Enter` 换行继承缩进与项目符号；`Shift+Backspace` 删到正文起点、整行无内容则删行并回到上一行行尾。
- **实时预览**：输入即生成，无需手动触发；点击节点名称折叠 / 展开，支持「全部折叠 / 全部展开」。
- **复制所见文本**：连同树形连接线一起复制。
- **历史输入**：本地记忆最近 20 条输入，点开「历史」下拉即可查看；鼠标悬停即在输入框预览该条内容，点击即恢复。
- **中英双语界面**：右上角按钮一键切换，选择会被记住。
- **亮 / 暗主题**：右上角一键切换，未手动选择前跟随系统。
- **零依赖、无构建**：纯 HTML / CSS / JavaScript，主题、语言、历史均存于 `localStorage`。

## 快速开始

```bash
git clone https://github.com/feyzhen/Text2Tree.git
cd Text2Tree
```

直接用浏览器打开 `index.html` 即可，也可以起一个本地静态服务：

```bash
# Python
python -m http.server 8899

# 或 Node
node serve-local.mjs
```

然后访问 `http://localhost:8899`。

部署同样简单：这是纯静态站点，GitHub Pages / Netlify / Cloudflare Pages / 对象存储等任意静态托管上传即用。

## 使用说明

### 输入

在左侧「输入」面板粘贴文本即可。空行会被忽略，每行会先做首尾去空白再成为节点。

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

生成结果：

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

同样的内容换成 `*` 缩进样式：

```text
* react-app
  * config/webpack.config.js/version.js
  * pages
    * home
  * package.json
```

### 规则与语法

1. **缩进定层级**：相同缩进为同一级；只能逐级递增、不能越级（越级会被收敛到当前可用的最深父级）。
2. **缩进样式**：工具栏可选 `2 空格`、`4 空格`、`*`、`-`、`+`。Markdown 符号在解析时被剥除、从不参与层级计算；切换到符号样式时会自动补回符号。
3. **`/` 同级展开**：行内用 `/`（或 `\`）分隔时，第一段为当前节点，其余段作为其同级子节点展开；`src/` 这类结尾分隔符会被忽略。多级目录请分行书写。

### 快捷键

| 按键 | 作用 |
| --- | --- |
| `Tab` / `Shift+Tab` | 整行增加 / 减少一级缩进（多行选区同时生效） |
| `Enter` / `Shift+Enter` | 换行时继承当前行缩进与项目符号（行中回车拆分亦保持层级） |
| `Shift+Backspace` | 从光标删到正文起点，保留行首缩进与符号；整行无内容则删除该行并回到上一行行尾 |
| `Backspace` | 在缩进行行首删除一个完整缩进单位（符号样式下整行退一级） |
| `Space` | 在行首缩进区输入空格时，自动补为一个缩进单位而非字面空格 |
| `Ctrl / Cmd + Enter` | 立即生成目录树 |
| `Esc` | 关闭历史下拉并还原被预览的输入 |

### 顶部按钮

| 按钮 | 作用 |
| --- | --- |
| ☾ / ☀ | 切换亮 / 暗主题（记忆于 `localStorage` 键 `t2t-theme`） |
| 中文 / EN | 切换界面语言（记忆于 `t2t-lang`）；首次访问按浏览器语言判断，默认英文 |
| GitHub 图标 | 打开仓库 |

### 历史输入

「输入」面板右上角的**历史**按钮会列出最近的输入（最多 20 条，新的在前，同内容去重）。

- **悬停**（或键盘聚焦）某条即可预览：输入框与右侧目录树立即切换为该条内容，鼠标移开自动还原。
- 每条都带一个角标，标明写入时的缩进样式；恢复时会把内容**换算成当前缩进样式**再填入，所以中途切换过样式也不会算错层级。
- **点击**某条即真正恢复该输入，同时把它移到列表最前。
- 下拉头部的**清空**可一键忘记全部历史。
- 记录时机：输入框失焦、按 `Ctrl`+`Enter`、点击「加载示例」。数据存于 `localStorage` 键 `t2t-history`。

## 项目结构

```text
Text2Tree/
├─ index.html       # 页面结构、i18n 标记、主题与语言预置脚本
├─ style.css        # 设计变量（亮 / 暗）与布局样式
├─ tree-core.js     # 纯逻辑核心：解析 / 树形渲染 / 缩进换算（UMD，浏览器与 Node 通用）
├─ app.js           # 交互层：编辑行为、缩进样式、主题、多语言、历史
└─ serve-local.mjs  # 可选的本地静态服务器
```

### 开发说明

- `tree-core.js` 不依赖框架、不触碰 DOM，可在 Node 中直接 `require("./tree-core.js")` 复用。
- 无构建步骤、无需包管理器，改完文件刷新即可。
- **多语言**：静态文案写在 HTML 的 `data-i18n` / `data-i18n-html` / `data-i18n-title` / `data-i18n-placeholder` / `data-i18n-aria` 属性上；动态文案集中在 `app.js` 的 `I18N` 字典里。新增语言 = 新增一个字典对象 + 一个按钮选项。
- `localStorage` 键：`t2t-theme`、`t2t-lang`、`t2t-history`，清除后即恢复默认。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。可自由使用、修改、分发甚至商用，只需保留版权声明与本许可证原文。

```text
Copyright (c) 2026 feyzhen
```
