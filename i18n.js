/* Text2Tree · i18n.js
 * 界面文案表（English / 简体中文）：app.js 的 t(key, vars) 从这里取词。
 * - 静态文案：index.html 上以 data-i18n / data-i18n-html / data-i18n-title /
 *   data-i18n-placeholder / data-i18n-aria 属性指向本表的键。
 * - 动态文案：各渲染函数直接调用 t()（支持 {name} 变量替换，缺词回退英文）。
 * 新增语言 = 在下方增加一个同结构的字典对象 + index.html 里加一个语言按钮选项。
 * 无 DOM 依赖，浏览器（window.T2T_I18N）与 Node（module.exports）通用。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.T2T_I18N = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  return {
    en: {
      docTitle: "Text2Tree · Text to Directory Tree",
      metaDesc:
        "A pure front-end tool that turns indented text or Markdown lists into a directory tree. Supports 2/4-space and Markdown (-, *, +) indent styles, Tab indenting, node collapsing and one-click copy — no backend, everything stays in your browser.",
      tagline: "Text / List → Directory Tree",
      themeToggle: "Toggle light / dark theme",
      themeDarkNow: "Dark theme · click to switch to light",
      themeLightNow: "Light theme · click to switch to dark",
      langToggle: "Switch interface language: English / 中文",
      repoLabel: "Text2Tree GitHub repository",
      repoTitle: "GitHub repository",

      toolbar: "Toolbar",
      indentStyle: "Indent style",
      indentHint: "Nesting is decided by leading spaces",
      chip2: "2 spaces",
      chip4: "4 spaces",
      chip2Title: "2 spaces per level; existing content is converted when switching",
      chip4Title: "4 spaces per level; existing content is converted when switching",
      chipMarkerTitle: "Markdown list marker — decorative only, does not affect nesting",
      chipMarkerAria: "Use the Markdown “{m}” indent style (the marker is decorative and does not affect nesting)",
      loadSample: "Load Sample",
      clear: "Clear",

      inputTitle: "Input",
      placeholder:
        "Paste or type text, a directory listing or a Markdown bullet list here.\n\nExample:\nreact-app\n  config/webpack.config.js/version.js\n  pages\n    home\n    package.json",
      previewTitle: "Tree Preview",
      collapseAll: "Collapse All",
      expandAll: "Expand All",
      copy: "Copy Text",
      copied: "Copied ✓",
      copyFail: "Copy failed — press Ctrl+C",
      emptyTitle: "Nothing here yet",
      emptyDesc: "Type or paste text above, or click “Load Sample”.",
      previewFoot: "Click a node name to collapse / expand",
      nodeToggle: "Collapse / expand this branch",

      docsSummary: "Usage",
      docsRuleH: "Rules & Syntax",
      docsRules:
        '<li><b>Indentation defines nesting:</b> nesting is decided solely by <b>leading spaces</b>; equal indentation means the same level, the first line is the top level, and levels may only increase one step at a time.</li>' +
        '<li><b>Indent styles:</b> pick <code>2 spaces</code>, <code>4 spaces</code>, <code>*</code>, <code>-</code> or <code>+</code>. The last three are Markdown list styles — the marker is decorative and <b>does not affect nesting</b>. Existing content is converted automatically when you switch.</li>' +
        '<li><b>“/” expands siblings:</b> when a line is split with <code>/</code> (or <code>\\</code>), the first segment is the current node and the remaining segments become its <b>sibling children</b>, e.g. <code>config/version.js</code>. Put deeper levels on separate lines.</li>',
      docsKeyH: "Shortcuts",
      docsKeys:
        "<li><b>Tab</b> / <b>Shift+Tab</b>: indent / outdent the whole line (works on multi-line selections too)</li>" +
        "<li><b>Enter</b> / <b>Shift+Enter</b>: the new line inherits the current indentation and bullet marker (splitting mid-line keeps the level)</li>" +
        "<li><b>Shift+Backspace</b>: delete up to the start of the content (indent and marker are kept); if the line has no content, remove the line and move to the end of the previous one</li>" +
        "<li><code>Ctrl / Cmd + Enter</code>: generate now; click a node name in the preview to collapse / expand it</li>",
      footer: "Text2Tree · Pure front-end · All data is processed locally in your browser",

      histBtn: "History",
      histBtnTitle: "Input history",
      histHead: "Recent inputs",
      histClear: "Clear",
      histClearTitle: "Clear input history",
      histNo: "No history yet",
      histUnitTitle: "Indent style this entry was written in — restoring converts it to your current style",
      histLines: "{n} lines",
      agoNow: "just now",
      agoMin: "{n} min ago",
      agoHour: "{n} h ago",
      agoDay: "{n} d ago",

      tipSpace: "Indent style: {w} spaces per level",
      tipMarker: "Indent style: Markdown “{m}” (marker is decorative)",
      footPrefix: "Nesting is decided by leading spaces — currently <b>{per}</b> per level. ",
      footPer: "{w} spaces",
      footPerMarker: "{w} spaces + {m}",
      footKeys:
        "<b>Tab</b> / <b>Shift+Tab</b> indent or outdent a whole line · <b>Enter</b> / <b>Shift+Enter</b> inherits the indentation · <code>/</code> expands siblings.",
      stat: "{total} nodes · {rows} rows shown",
      statCollapsed: " ({n} collapsed)",
    },
    zh: {
      docTitle: "Text2Tree · 文本转目录树",
      metaDesc:
        "纯前端文本 / 无序列表 转目录树工具，支持 2 / 4 空格与 Markdown（-、*、+）缩进样式自动换算、Tab 增删缩进、节点折叠、复制树形文本，数据仅在浏览器本地处理。",
      tagline: "文本 / 列表 → 目录树",
      themeToggle: "切换亮 / 暗主题",
      themeDarkNow: "当前为暗色主题 · 点击切换为亮色",
      themeLightNow: "当前为亮色主题 · 点击切换为暗色",
      langToggle: "切换界面语言：中文 / English",
      repoLabel: "Text2Tree 的 GitHub 仓库",
      repoTitle: "GitHub 仓库",

      toolbar: "工具栏",
      indentStyle: "缩进样式",
      indentHint: "层级由行首空格决定",
      chip2: "2 空格",
      chip4: "4 空格",
      chip2Title: "每级缩进 2 个空格；切换时按原层级自动换算",
      chip4Title: "每级缩进 4 个空格；切换时按原层级自动换算",
      chipMarkerTitle: "Markdown 列表符号，仅装饰、不参与分层",
      chipMarkerAria: "使用 Markdown“{m}”缩进样式（符号仅装饰、不参与分层）",
      loadSample: "加载示例",
      clear: "清空",

      inputTitle: "输入",
      placeholder:
        "在这里粘贴或输入文本、目录结构或 Markdown 无序列表\n\n示例：\nreact-app\n  config/webpack.config.js/version.js\n  pages\n    home\n    package.json",
      previewTitle: "目录树预览",
      collapseAll: "全部折叠",
      expandAll: "全部展开",
      copy: "复制文本",
      copied: "已复制 ✓",
      copyFail: "复制失败：请手动 Ctrl+C",
      emptyTitle: "还没有内容",
      emptyDesc: "在上方输入文本 / 列表，或点击「加载示例」。",
      previewFoot: "点击节点名称可折叠 / 展开",
      nodeToggle: "折叠 / 展开该分支",

      docsSummary: "使用说明",
      docsRuleH: "规则与语法",
      docsRules:
        '<li><b>缩进定层级：</b>层级一律由<b>行首空格</b>决定，相同缩进为同一级，首行为顶层，只能逐级递增、不能越级。</li>' +
        '<li><b>缩进样式：</b>可选 <code>2 空格</code>、<code>4 空格</code>、<code>*</code>、<code>-</code>、<code>+</code>；后三者是 Markdown 列表写法，符号仅装饰、<b>不参与分层</b>。切换样式时已输入内容自动换算。</li>' +
        '<li><b>“/”同级展开：</b>行内用 <code>/</code>（或 <code>\\</code>）分隔时，第一段为当前节点，其余段作为其<b>同级子节点</b>展开，例如 <code>config/version.js</code>。多级目录请分行书写。</li>',
      docsKeyH: "快捷键",
      docsKeys:
        "<li><b>Tab</b> / <b>Shift+Tab</b>：整行增加 / 减少一级缩进（多行选区同时生效）</li>" +
        "<li><b>Enter</b> / <b>Shift+Enter</b>：换行时继承当前行缩进与项目符号（行中回车拆分亦保持层级）</li>" +
        "<li><b>Shift+Backspace</b>：删到正文起点（保留缩进与符号）；整行无内容则删除该行并回到上一行行尾</li>" +
        "<li><code>Ctrl / Cmd + Enter</code>：立即生成；预览区点击节点名称折叠 / 展开</li>",
      footer: "Text2Tree · 纯前端 · 数据仅在浏览器本地处理",

      histBtn: "历史",
      histBtnTitle: "历史输入",
      histHead: "最近输入",
      histClear: "清空",
      histClearTitle: "清空历史记录",
      histNo: "暂无历史记录",
      histUnitTitle: "该条写入时的缩进样式；恢复时会按当前样式换算后填入",
      histLines: "{n} 行",
      agoNow: "刚刚",
      agoMin: "{n} 分钟前",
      agoHour: "{n} 小时前",
      agoDay: "{n} 天前",

      tipSpace: "缩进样式：每级 {w} 空格",
      tipMarker: "缩进样式：Markdown “{m}”（符号仅装饰）",
      footPrefix: "层级由行首空格决定，当前每级 <b>{per}</b>。",
      footPer: "{w} 空格",
      footPerMarker: "{w} 空格 + {m}",
      footKeys: "<b>Tab</b> / <b>Shift+Tab</b> 整行增减一级 · <b>Enter</b> / <b>Shift+Enter</b> 继承缩进 · 行内 <code>/</code> 同级展开。",
      stat: "共 {total} 个节点 · 当前显示 {rows} 行",
      statCollapsed: "（已折叠 {n}）",
    },
  };
});
