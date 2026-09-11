/* Text2Tree · app.js — 交互层。缩进样式支持 2 空格 / 4 空格 / Markdown（-、*、+），层级一律由行首空格决定，切换时自动换算；行首输入空格自动补足缩进。依赖 window.TreeCore */
(function () {
  "use strict";
  const C = window.TreeCore;

  const $ = (s) => document.querySelector(s);
  const editor = $("#editor");
  const treeRowsEl = $("#treeRows");
  const emptyTip = $("#emptyTip");
  const statText = $("#statText");
  const editorTip = $("#editorTip");
  const editorFoot = $("#editorFoot");
  const histWrap = $("#histWrap");
  const histBtn = $("#histBtn");
  const histMenu = $("#histMenu");
  const histList = $("#histList");
  const histClear = $("#histClear");

  const state = {
    unit: "  ", // 缩进样式：两个空格 / 四个空格 / “-” / “*” / “+”
    collapse: {}, // ckey -> true
    nodes: [], // 当前解析出的顶层节点
    timer: null,
    // 界面语言：取自 index.html <head> 预置脚本写入的 html[data-lang]（记忆 > 浏览器语言 > 英文）
    lang: document.documentElement.getAttribute("data-lang") === "zh" ? "zh" : "en",
  };

  let nodeById = new Map();
  let lastTreeHtml = null; // 上次写入预览区的行 HTML，用于跳过无变化的重复渲染

  /* ---------- 多语言（i18n）：文案表见 i18n.js ---------- */

  const LANG_KEY = "t2t-lang"; // 语言记忆键（与 index.html <head> 预置脚本同键）
  const I18N = window.T2T_I18N; // 文案表由 i18n.js 提供（I18N.en / I18N.zh）

  // 取词：key + 可选 {name} 变量替换；缺词回退英文，再回退 key 本身
  function t(key, vars) {
    const dict = I18N[state.lang] || I18N.en;
    let out = dict[key];
    if (out == null) out = I18N.en[key];
    if (out == null) return key;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
    return out;
  }

  // 静态文案走 HTML 上的 data-i18n* 属性，动态文案由各自渲染函数调用 t()
  const I18N_ATTRS = [
    ["data-i18n", "textContent"],
    ["data-i18n-html", "innerHTML"],
    ["data-i18n-title", "title"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-aria", "aria-label"],
  ];

  function applyI18n() {
    for (const [attr, prop] of I18N_ATTRS) {
      document.querySelectorAll("[" + attr + "]").forEach((el) => {
        const v = t(el.getAttribute(attr));
        if (prop === "textContent") el.textContent = v;
        else if (prop === "innerHTML") el.innerHTML = v;
        else el.setAttribute(prop, v);
      });
    }

    const root = document.documentElement;
    root.lang = state.lang === "zh" ? "zh-CN" : "en";
    root.setAttribute("data-lang", state.lang); // 语言按钮的高亮态由 CSS 依据该属性决定
    document.title = t("docTitle");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("metaDesc"));
    document.querySelectorAll("#langToggle .lang-opt").forEach((el) => {
      el.setAttribute("aria-pressed", String(el.dataset.lang === state.lang));
    });

    syncUnitUI(); // 输入区提示 / 底部说明
    syncThemeUI(); // 主题按钮提示
    renderHistory(); // 历史列表（时间、行数）
    renderTree(); // 预览统计
  }

  function setLang(lang) {
    if ((lang !== "zh" && lang !== "en") || lang === state.lang) return;
    state.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {
      /* 隐私模式：本次会话内生效即可 */
    }
    applyI18n();
  }

  const langToggleBtn = $("#langToggle");
  if (langToggleBtn) {
    langToggleBtn.addEventListener("click", () => setLang(state.lang === "zh" ? "en" : "zh"));
  }

  // 当前样式对应的“空格缩进文本”（符号样式下每级仍为固定宽度的空格）
  function indentText() {
    return " ".repeat(C.presetOf(state.unit).width || 2);
  }

  /* ---------- 状态 / 节点辅助 ---------- */

  function refreshCollapseFromMap() {
    const map = state.collapse;
    (function walk(list) {
      for (const n of list) {
        if (map[n.ckey] && n.children.length) n.collapsed = true;
        walk(n.children);
      }
    })(state.nodes);
  }

  function rememberCollapse() {
    const map = {};
    (function walk(list) {
      for (const n of list) {
        if (n.children.length) map[n.ckey] = !!n.collapsed;
        walk(n.children);
      }
    })(state.nodes);
    state.collapse = map;
  }

  /* ---------- 渲染预览 ---------- */

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ESC[m]);

  function renderTree() {
    refreshCollapseFromMap();

    const rows = C.renderRows(state.nodes);
    const total = C.countNodes(state.nodes); // 节点统计复用核心实现

    const scrollEl = treeRowsEl.parentElement;
    const prevScroll = scrollEl ? scrollEl.scrollTop : 0;

    nodeById = new Map();
    const parts = [];
    for (const r of rows) {
      nodeById.set(r.node.id, r.node);
      const cls = ["tname"];
      if (r.hasKids) cls.push("folder");
      if (r.collapsed) cls.push("collapsed");
      parts.push(
        '<div class="trow" data-id="' + r.node.id + '">' +
          esc(r.prefix + r.conn) +
          '<span class="' + cls.join(" ") + '" data-id="' + r.node.id + '"' +
          (r.hasKids ? ' title="' + esc(t("nodeToggle")) + '"' : "") + ">" +
          esc(r.name) + "</span>" +
          "</div>"
      );
    }
    emptyTip.hidden = rows.length > 0;

    // 行内容没变（例如只切换了界面语言）就不重写 DOM，省掉一次整体重排
    const html = parts.join("");
    if (html !== lastTreeHtml) {
      treeRowsEl.innerHTML = html;
      lastTreeHtml = html;
      if (scrollEl) scrollEl.scrollTop = prevScroll;
    }

    const stat = t("stat", { total: total, rows: rows.length }) +
      (total > rows.length ? t("statCollapsed", { n: total - rows.length }) : "");
    if (statText.textContent !== stat) statText.textContent = stat;
  }

  function regenerate() {
    rememberCollapse();
    state.nodes = C.parseText(editor.value, state.unit);
    renderTree();
  }

  // 输入变化即自动重生成（已取消「自动生成」开关，无需再判断）
  function scheduleRegenerate() {
    clearTimeout(state.timer);
    state.timer = setTimeout(regenerate, 250);
  }

  /* ---------- 缩进样式：切换换算 ---------- */

  function syncUnitUI() {
    const preset = C.presetOf(state.unit);
    document.querySelectorAll(".chip[data-unit]").forEach((ch) => {
      const on = ch.dataset.unit === state.unit;
      ch.classList.toggle("active", on);
      ch.setAttribute("aria-pressed", String(on));
    });
    editorTip.textContent = preset.marker
      ? t("tipMarker", { m: preset.marker })
      : t("tipSpace", { w: preset.width });
    const per = preset.marker
      ? t("footPerMarker", { w: preset.width, m: preset.marker })
      : t("footPer", { w: preset.width });
    editorFoot.innerHTML = t("footPrefix", { per: per }) + t("footKeys");
  }

  function setUnit(newUnit) {
    if (newUnit === state.unit) return;
    const oldUnit = state.unit;
    state.unit = newUnit;
    editor.value = C.convertIndentUnits(editor.value, oldUnit, newUnit); // 保持层级自动换算
    syncUnitUI();
    regenerate();
    editor.focus();
  }

  /* ---------- 编辑区缩进工具 ---------- */

  function isMultiline(v, s, e) {
    return v.slice(s, e).indexOf("\n") !== -1;
  }

  function lineRegion(v, s, e) {
    const start = v.lastIndexOf("\n", s - 1) + 1;
    const rawEnd = v.indexOf("\n", e);
    const end = rawEnd === -1 ? v.length : rawEnd;
    return [start, end];
  }

  // 返回光标所在行：{ start 行首索引, end 行尾索引(不含换行), line 行文本 }
  function caretLine(v, pos) {
    const start = v.lastIndexOf("\n", pos - 1) + 1;
    let end = v.indexOf("\n", start);
    if (end === -1) end = v.length;
    return { start, end, line: v.slice(start, end) };
  }

  // 识别“符号列表行”：行首缩进后紧跟 * / - / + 且其后为空白或行尾。
  // 返回 { indLen 前导空白数, marker 符号, contentStart 正文起点 }；不是列表行返回 null。
  function listInfo(line) {
    const ind = /^[ \t]*/.exec(line)[0];
    const i = ind.length;
    const ch = line[i];
    if (ch === undefined || !/[-*+]/.test(ch)) return null;
    const next = line[i + 1];
    if (next !== undefined && !/[ \t]/.test(next)) return null; // 符号后紧贴正文 → 视为普通文本
    const wsAfter = /^[ \t]*/.exec(line.slice(i + 1))[0].length;
    return { indLen: i, marker: ch, contentStart: i + 1 + wsAfter };
  }

  // 符号行“空正文”判定：符号后（含符号后空白）没有任何非空白字符
  function blankMarkerBody(line, li) {
    return !/\S/.test(line.slice(li.contentStart));
  }

  // 空正文符号行的规范形：缩进 + 符号 + 单个空格（顺带清掉正文区多余空白）
  function canonicalBlankMarker(indent, marker) {
    return indent + marker + " ";
  }

  // 符号样式：整行右移一级（符号连同缩进一起右移，不往正文里塞空格）——对应 Tab / 行首空格
  function markerIndentRight() {
    const ta = editor;
    const v = ta.value;
    const s = ta.selectionStart;
    const { start, line } = caretLine(v, s);
    const li = listInfo(line);
    if (!li) return false;
    const col = s - start;
    const w = indentText();

    if (blankMarkerBody(line, li)) {
      // 空正文：整行规范化为「缩进+一级 + 符号 + 空格」，顺带清掉正文区多余空白
      const next = canonicalBlankMarker(line.slice(0, li.indLen) + w, li.marker);
      ta.setRangeText(next, start, start + line.length, "end");
      const caret = col <= li.indLen ? col + w.length : next.length;
      ta.selectionStart = ta.selectionEnd = start + caret;
      return true;
    }

    ta.setRangeText(w, start, start, "end"); // 行首前插一个缩进单位 → 整行右移
    const cs = Math.min(li.contentStart, line.length);
    const newCol = col <= cs ? cs + w.length : col + w.length;
    ta.selectionStart = ta.selectionEnd = start + newCol;
    return true;
  }

  // 符号样式：整行左移一级 —— 对应 Shift+Tab / 行首 Backspace
  function markerIndentLeft() {
    const ta = editor;
    const v = ta.value;
    const s = ta.selectionStart;
    const { start, line } = caretLine(v, s);
    const li = listInfo(line);
    if (!li) return false;
    const col = s - start;
    const cut = Math.min(indentText().length, li.indLen);
    if (cut <= 0) return false;
    const ind = line.slice(0, li.indLen - cut);

    if (blankMarkerBody(line, li)) {
      // 空正文：整行规范化（去掉一级缩进 + 清掉正文区多余空白）
      const next = canonicalBlankMarker(ind, li.marker);
      ta.setRangeText(next, start, start + line.length, "end");
      const caret = col <= li.indLen ? Math.max(0, col - cut) : next.length;
      ta.selectionStart = ta.selectionEnd = start + caret;
      return true;
    }

    ta.setRangeText("", start, start + cut, "end");
    const cs = Math.min(li.contentStart, line.length);
    const newCol = col <= cs ? Math.max(0, cs - cut) : Math.max(0, col - cut);
    ta.selectionStart = ta.selectionEnd = start + newCol;
    return true;
  }

  function handleTab(shiftKey) {
    const ta = editor;
    const v = ta.value;
    let s = ta.selectionStart;
    let e = ta.selectionEnd;
    const unit = indentText(); // 编辑时“一级缩进”始终以空格表示（符号仅装饰）
    const pres = C.presetOf(state.unit);

    if (s === e && !isMultiline(v, s, e)) {
      // —— 无选区：一律对“整行”增减一级（光标在行内任意位置都作用于行首缩进）——
      if (!shiftKey) {
        if (pres.marker && markerIndentRight()) {
          scheduleRegenerate();
          return;
        }
        // 空格样式：行首插入一个缩进单位 → 整行右移，光标保持原列位置
        const { start: lineStart } = caretLine(v, s);
        const col = s - lineStart;
        ta.setRangeText(unit, lineStart, lineStart, "end");
        ta.selectionStart = ta.selectionEnd = lineStart + col + unit.length;
      } else {
        if (pres.marker && markerIndentLeft()) {
          scheduleRegenerate();
          return;
        }
        // 空格样式：从行首删除至多一个缩进单位 → 整行左移，光标随之左移
        const { start: lineStart, line: curLine } = caretLine(v, s);
        const indLen = /^[ \t]*/.exec(curLine)[0].length;
        if (indLen > 0) {
          const cut = Math.min(unit.length, indLen);
          ta.setRangeText("", lineStart, lineStart + cut, "end");
          ta.selectionStart = ta.selectionEnd = Math.max(lineStart, s - cut);
        }
      }
      scheduleRegenerate();
      return;
    }

    // —— 多行 / 选中整行 ——
    const [ls, le] = lineRegion(v, s, e);
    const before = v.slice(0, ls);
    const after = v.slice(le);
    const lines = v.slice(ls, le).split("\n");

    const out = lines.map((line) => {
      if (!shiftKey) return unit + line;
      if (line.startsWith(unit)) return line.slice(unit.length);
      const sp = /^ +/.exec(line);
      if (sp) {
        const k = Math.min(sp[0].length, unit.length);
        return line.slice(k);
      }
      if (line[0] === "\t") return line.slice(1);
      return line;
    });

    const region = out.join("\n");
    ta.value = before + region + after;
    ta.selectionStart = ls;
    ta.selectionEnd = ls + region.length;
    scheduleRegenerate();
  }

  // Enter / Shift+Enter：在光标处换行，并继承本行行首缩进（符号样式下连同项目符号），
  // 使光标后的内容移到新行时保持原有层级
  function enterInherit() {
    const ta = editor;
    if (ta.selectionStart !== ta.selectionEnd) return false;
    const v = ta.value;
    const s = ta.selectionStart;
    const { line } = caretLine(v, s);

    // 与 listInfo 共用同一套「符号行」判定，避免两处规则漂移
    const li = listInfo(line);
    const indent = li ? line.slice(0, li.indLen) + li.marker + " " : /^[ \t]*/.exec(line)[0];
    ta.setRangeText("\n" + indent, s, s, "end");
    scheduleRegenerate();
    return true;
  }

  // 删除光标所在整行（含其换行），焦点回退到上一行行尾
  function deleteLineToPrev() {
    const ta = editor;
    const v = ta.value;
    if (!v.length) return false;
    const s = ta.selectionStart;
    const { start, end } = caretLine(v, s);
    if (end < v.length) {
      // 行后有换行：删除本行内容 + 它的换行，下一行自动上移
      ta.setRangeText("", start, end + 1, "end");
      ta.selectionStart = ta.selectionEnd = start > 0 ? start - 1 : 0;
    } else {
      // 末行：连同上一个换行一起删除，回到上一行行尾
      const from = start > 0 ? start - 1 : start;
      ta.setRangeText("", from, v.length, "end");
      ta.selectionStart = ta.selectionEnd = from;
    }
    return true;
  }

  // Shift+Backspace：行内有正文 → 从光标删除到“正文起点”（行首缩进之后；符号样式行还要跨过符号），
  // 只删正文、保留行首缩进与符号装饰；整行无正文 → 删除该行并回上一行行尾
  function shiftBackspace() {
    const ta = editor;
    if (ta.selectionStart !== ta.selectionEnd) return false;
    const v = ta.value;
    const s = ta.selectionStart;
    if (!v.length) return false;
    const { start, line } = caretLine(v, s);

    // “有正文”判定：符号样式下只看符号后的正文；其余看行首缩进之后是否有非空白字符
    const pres = C.presetOf(state.unit);
    let hasContent;
    let li = null;
    if (pres.marker) {
      li = listInfo(line);
      hasContent = li ? /\S/.test(line.slice(li.contentStart)) : /\S/.test(line);
    } else {
      hasContent = /\S/.test(line);
    }

    if (hasContent) {
      // 正文起点（行内相对列，需加回行首绝对索引 start）：
      // - 符号行：“缩进 + 符号 + 符号后空白”之后（“    * demo.jpg” → “    * ”）
      // - 普通行：行首缩进空白之后（“    home” → “    ”，保留缩进、不删到最行首）
      let col;
      if (li) {
        col = Math.min(li.contentStart, line.length);
      } else {
        const ind = /^[ \t]*/.exec(line)[0].length;
        col = Math.min(ind, line.length);
      }
      const to = start + col;
      if (s <= to) return false; // 光标已在正文起点之前 → 交给默认行为
      ta.setRangeText("", to, s, "end");
      scheduleRegenerate();
      return true;
    }
    if (deleteLineToPrev()) {
      scheduleRegenerate();
      return true;
    }
    return false;
  }

  // Backspace：符号样式下，光标位于符号行“缩进/符号区”时整行退一级（同 Shift+Tab），
  // 避免出现按两次退格才能消除“* ”的情况；空格样式下按整单位删除行首空白。
  function backspaceDedent() {
    const ta = editor;
    if (ta.selectionStart !== ta.selectionEnd) return false;
    const v = ta.value;
    const s = ta.selectionStart;
    const { start, line } = caretLine(v, s);
    if (s <= start) return false; // 行首：交给默认行为合并上一行
    const col = s - start;
    const pres = C.presetOf(state.unit);

    if (pres.marker) {
      const li = listInfo(line);
      if (li) {
        const cs = Math.min(li.contentStart, line.length);
        // 空正文行残留的多余空白（“缩进 + 符号 + 一个空格”之后）→ 先逐格删掉
        const canonLen = li.indLen + 2;
        if (blankMarkerBody(line, li) && col > canonLen && col <= cs) {
          ta.setRangeText("", s - 1, s, "end");
          scheduleRegenerate();
          return true;
        }
        if (col <= cs) {
          // 光标在符号行前缀区（缩进空白 / 符号 / 符号后空格）→ 整行退一级
          if (li.indLen > 0) {
            if (markerIndentLeft()) {
              scheduleRegenerate();
              return true;
            }
          }
          // 顶层符号行：去掉符号；若符号后无正文则整行删除并上接上一行
          if (!/\S/.test(line.slice(cs))) {
            if (deleteLineToPrev()) {
              scheduleRegenerate();
              return true;
            }
          } else {
            ta.setRangeText("", start, start + cs, "end");
            scheduleRegenerate();
            return true;
          }
          return true;
        }
        return false; // 已进入正文 → 默认删除
      }
    }

    // 非符号行 / 空格样式：行首缩进区整单位删除
    const prefix = line.slice(0, col);
    if (!/^\s+$/.test(prefix)) return false; // 光标左侧不是纯空白 → 默认删除
    const cut = Math.min(prefix.length, indentText().length);
    if (cut <= 0) return false;
    ta.setRangeText("", s - cut, s, "end");
    scheduleRegenerate();
    return true;
  }

  // 行首（缩进区）输入空格 → 符号样式下整行右移一级（同 Tab）；空格样式下补成当前缩进单位
  function spaceInIndent() {
    const ta = editor;
    if (ta.selectionStart !== ta.selectionEnd) return false;
    const v = ta.value;
    const s = ta.selectionStart;
    const { start, line } = caretLine(v, s);
    const col = s - start;
    const pres = C.presetOf(state.unit);

    // 符号样式：光标在缩进空白区，或所在符号行正文为空（符号后已有一个空格）→ 像 Tab 一样整行右移一级
    if (pres.marker) {
      const li = listInfo(line);
      if (li) {
        const wsAfter = li.contentStart - li.indLen - 1; // 符号后的空白数
        if (col <= li.indLen || (wsAfter >= 1 && blankMarkerBody(line, li))) {
          if (markerIndentRight()) {
            scheduleRegenerate();
            return true;
          }
        }
      }
    }

    const prefix = line.slice(0, col);
    if (prefix && !/^[ \t]+$/.test(prefix)) return false; // 光标左侧非行首空白 → 普通空格
    ta.setRangeText(indentText(), s, s, "end");
    scheduleRegenerate();
    return true;
  }

  /* ---------- 事件绑定 ---------- */

  editor.addEventListener("keydown", (ev) => {
    if (ev.isComposing) return; // 不干扰输入法

    if (ev.key === " " && !ev.shiftKey) {
      if (spaceInIndent()) ev.preventDefault();
      return;
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      handleTab(ev.shiftKey);
      return;
    }
    if (ev.key === "Backspace") {
      if (ev.shiftKey) {
        // Shift+Backspace：删光标到行首；空行则删行并回上一行行尾
        if (shiftBackspace()) ev.preventDefault();
      } else if (backspaceDedent()) {
        ev.preventDefault();
      }
      return;
    }
    if (ev.key === "Enter") {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        regenerate();
        pushHistory(editor.value);
      } else if (enterInherit()) {
        ev.preventDefault();
      }
      return;
    }
  });

  editor.addEventListener("input", scheduleRegenerate);

  // Ctrl/Cmd+Enter 全局兜底
  document.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter" && document.activeElement !== editor) {
      regenerate();
      pushHistory(editor.value);
    }
  });

  document.querySelectorAll(".chip[data-unit]").forEach((ch) => {
    ch.addEventListener("click", () => setUnit(ch.dataset.unit));
  });

  $("#loadSample").addEventListener("click", () => {
    editor.value = C.buildSample(state.unit); // 按当前缩进单位生成示例
    regenerate();
    pushHistory(editor.value);
    editor.focus();
  });
  $("#clearBtn").addEventListener("click", () => {
    editor.value = "";
    regenerate();
    editor.focus();
  });

  $("#collapseAll").addEventListener("click", () => {
    C.collapseAll(state.nodes);
    rememberCollapse();
    renderTree();
  });
  $("#expandAll").addEventListener("click", () => {
    C.expandAll(state.nodes);
    rememberCollapse();
    renderTree();
  });

  // 点击节点名称 → 折叠 / 展开
  treeRowsEl.addEventListener("click", (ev) => {
    const nameEl = ev.target.closest(".tname.folder");
    if (!nameEl) return;
    const id = Number(nameEl.dataset.id);
    const node = nodeById.get(id);
    if (!node || !node.children.length) return;
    node.collapsed = !node.collapsed;
    rememberCollapse();
    renderTree();
  });

  $("#copyBtn").addEventListener("click", copyTree);

  async function copyTree() {
    const rows = C.renderRows(state.nodes);
    const text = C.rowsToText(rows);
    const btn = $("#copyBtn");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no-clipboard-api");
      }
      flash(btn, "copied");
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e2) {
        ok = false;
      }
      ta.remove();
      if (ok) flash(btn, "copied");
      else flash(btn, "copyFail", true);
    }
  }

  let flashTimer = null;
  // msgKey 为 I18N 文案键，恢复文案固定取 copy（切换语言后仍正确）
  function flash(btn, msgKey, isErr) {
    btn.textContent = t(msgKey);
    btn.classList.toggle("btn-primary", !isErr);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      btn.textContent = t("copy");
      btn.classList.toggle("btn-primary", true);
    }, 1400);
  }

  /* ---------- 亮 / 暗主题切换 ---------- */
  const THEME_KEY = "t2t-theme"; // 与 index.html <head> 预置脚本同键

  function syncThemeUI() {
    const btn = $("#themeToggle");
    if (!btn) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const label = t(isDark ? "themeDarkNow" : "themeLightNow");
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-pressed", String(isDark));
  }

  $("#themeToggle").addEventListener("click", () => {
    const root = document.documentElement;
    const isDark = root.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* 隐私模式等：本次会话生效即可 */ }
    root.setAttribute("data-theme", next);
    syncThemeUI();
  });

  /* ---------- 历史输入（localStorage 记忆） ---------- */

  const HIST_KEY = "t2t-history";
  const HIST_MAX = 20; // 最多保留条数
  let history = [];
  let previewing = false; // 是否正在“悬停预览”某条历史
  let previewBackup = null; // 预览前的编辑器内容
  let activeItem = null; // 当前悬停 / 聚焦的历史条目
  let releaseTimer = null; // 延迟还原预览的计时器
  const previewPanels = document.querySelectorAll(".editor-panel, .preview-panel");

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((it) => it && typeof it.text === "string" && it.text.trim())
        .map((it) => ({
          text: it.text,
          at: Number(it.at) || Date.now(),
          // 记录该条输入写入时的缩进样式：取用时按它换算，否则层级（目录树）会走样
          unit: typeof it.unit === "string" && it.unit ? it.unit : "",
        }))
        .slice(0, HIST_MAX);
    } catch (e) {
      return [];
    }
  }

  function persistHistory() {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(history));
    } catch (e) {
      /* 隐私模式 / 配额不足：本次会话内可用即可 */
    }
  }

  // 记一条历史：与最新一条相同则跳过；否则去重后提到最前。unit 缺省 = 当前缩进样式
  function pushHistory(text, unit) {
    const v = String(text == null ? "" : text);
    if (!v.trim()) return;
    const u = typeof unit === "string" && unit ? unit : state.unit;
    if (history.length && history[0].text === v && history[0].unit === u) return;
    history = [{ text: v, at: Date.now(), unit: u }]
      .concat(history.filter((it) => !(it.text === v && it.unit === u))) // 同文本不同样式视为不同条目
      .slice(0, HIST_MAX);
    persistHistory();
    renderHistory();
  }

  // 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 月-日
  function timeAgo(at) {
    const d = Date.now() - at;
    const MIN = 60000;
    const HOUR = 3600000;
    const DAY = 86400000;
    if (d < MIN) return t("agoNow");
    if (d < HOUR) return t("agoMin", { n: Math.floor(d / MIN) });
    if (d < DAY) return t("agoHour", { n: Math.floor(d / HOUR) });
    if (d < 7 * DAY) return t("agoDay", { n: Math.floor(d / DAY) });
    const dt = new Date(at);
    const p = (n) => String(n).padStart(2, "0");
    return p(dt.getMonth() + 1) + "-" + p(dt.getDate());
  }

  // 摘要：首个非空行（去行首缩进与 Markdown 符号）+ 有效行数
  function historyLabel(text) {
    const lines = String(text).split("\n").filter((l) => l.trim());
    const first = (lines[0] || "").trim().replace(/^[-*+][ \t]+/, "");
    return { label: first.length > 48 ? first.slice(0, 48) + "…" : first, count: lines.length };
  }

  // 历史条目角标：标注该条写入时的缩进样式（2 空格 / 4 空格 / * - +）
  function unitLabel(unit) {
    const p = C.presetOf(unit);
    if (p.marker) return p.marker;
    return t(p.width >= 4 ? "chip4" : "chip2");
  }

  // 历史文本按写入时的样式保存；取用时换算成目标样式，保证层级（目录树）正确。
  // 旧数据没有 unit 字段 → 原样使用，不做换算。
  function historyText(it, toUnit) {
    const from = it.unit || toUnit;
    if (!from || from === toUnit) return it.text;
    return C.convertIndentUnits(it.text, from, toUnit);
  }

  function renderHistory() {
    if (!histList) return;
    activeItem = null;
    if (!history.length) {
      histList.innerHTML = '<li class="hist-empty">' + esc(t("histNo")) + "</li>";
      return;
    }
    histList.innerHTML = history
      .map((it, i) => {
        const info = historyLabel(it.text);
        const tag = it.unit
          ? '<span class="hist-unit" title="' + esc(t("histUnitTitle")) + '">' +
            esc(unitLabel(it.unit)) + "</span>"
          : "";
        return (
          '<li class="hist-item" role="option" tabindex="0" aria-selected="false" data-i="' + i + '" title="' +
          esc(it.text.slice(0, 400)) + '">' +
          '<span class="hist-sum">' + esc(info.label) + "</span>" + tag +
          '<span class="hist-meta">' + esc(t("histLines", { n: info.count })) + " · " +
          esc(timeAgo(it.at)) + "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  // 预览渲染：只替换解析结果，不反写折叠状态表（否则预览历史会丢掉原内容的折叠状态）
  function showText(text) {
    state.nodes = C.parseText(text, state.unit);
    renderTree();
  }

  // “预览中”的可见反馈：两侧面板整体描边高亮。
  // 即使该条内容与当前编辑器完全相同（历史首条常是当前内容），也能看出预览已生效。
  function setPreviewUI(on) {
    previewPanels.forEach((el) => el.classList.toggle("is-preview", on));
  }

  function beginPreview(idx) {
    const it = history[idx];
    if (!it) return;
    const text = historyText(it, state.unit); // 按当前缩进样式换算后再预览
    if (!previewing) {
      previewBackup = editor.value; // 首次悬停时备份当前内容
      previewing = true;
    }
    setPreviewUI(true);
    if (editor.value !== text) {
      editor.value = text;
      showText(text);
    }
  }

  function endPreview() {
    clearTimeout(releaseTimer);
    releaseTimer = null;
    if (previewing) {
      editor.value = previewBackup == null ? "" : previewBackup;
      previewing = false;
      previewBackup = null;
      showText(editor.value);
    }
    setPreviewUI(false);
  }

  // 指针离开列表后延迟还原：若随即移到编辑器 / 目录树面板，则保持预览（方便对照查看效果）
  function scheduleEndPreview() {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(endPreview, 320);
  }

  // 指针是否仍停在「可保持预览」的区域：两个面板（历史下拉本身就在编辑器面板内）
  function inKeepArea(el) {
    return !!(el && el.closest && el.closest(".editor-panel, .preview-panel"));
  }

  // 移回可保持预览的区域 → 取消待还原计时，否则从下拉挪到编辑区时预览会被 320ms 掉
  function cancelEndPreview() {
    if (!releaseTimer) return;
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  // 当前项高亮（同时维护 listbox 的 aria-selected 状态）
  function setActiveItem(el) {
    activeItem = el;
    histList.querySelectorAll(".hist-item").forEach((it) => {
      it.setAttribute("aria-selected", String(it === el));
    });
  }

  function openHistory() {
    if (!histMenu) return;
    renderHistory();
    histMenu.hidden = false;
    histBtn.setAttribute("aria-expanded", "true");
  }

  function closeHistory() {
    if (!histMenu || histMenu.hidden) return;
    histMenu.hidden = true;
    histBtn.setAttribute("aria-expanded", "false");
    activeItem = null;
    endPreview(); // 关闭时若仍在预览，恢复原内容
  }

  // 点击 / 回车确认：把该条历史换算成当前缩进样式后恢复进编辑器，并提到列表最前
  function commitItem(idx) {
    const it = history[idx];
    if (!it) return;
    previewing = false;
    previewBackup = null;
    const text = historyText(it, state.unit);
    editor.value = text;
    pushHistory(text); // 以当前样式记为新的一条（同文本同样式自动去重）
    closeHistory();
    regenerate();
    editor.focus();
  }

  if (histMenu && histList) {
    // 悬停 / 聚焦某条 → 编辑器与目录树变为该条预览；移开 → 还原。
    // 监听挂在下拉整体（含表头）上：在「列表 ↔ 表头」之间移动不会误触发还原。
    histMenu.addEventListener("mouseover", (ev) => {
      const item = ev.target.closest(".hist-item");
      if (!item || item === activeItem) return;
      setActiveItem(item);
      cancelEndPreview(); // 回到列表 → 取消待还原
      beginPreview(Number(item.dataset.i));
    });
    histMenu.addEventListener("mouseleave", (ev) => {
      setActiveItem(null);
      // 稍等片刻：若随即移到编辑器 / 目录树面板则保持预览
      if (inKeepArea(ev.relatedTarget)) cancelEndPreview();
      else scheduleEndPreview();
    });
    histList.addEventListener("focusin", (ev) => {
      const item = ev.target.closest(".hist-item");
      if (!item || item === activeItem) return;
      setActiveItem(item);
      beginPreview(Number(item.dataset.i));
    });
    histList.addEventListener("focusout", () => {
      setTimeout(() => {
        if (histList.contains(document.activeElement)) return;
        setActiveItem(null);
        endPreview();
      }, 0);
    });
    // 点击 → 恢复该条输入
    histList.addEventListener("click", (ev) => {
      const item = ev.target.closest(".hist-item");
      if (item) commitItem(Number(item.dataset.i));
    });
    histList.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const item = ev.target.closest(".hist-item");
      if (!item) return;
      ev.preventDefault();
      commitItem(Number(item.dataset.i));
    });
  }

  if (histBtn) {
    histBtn.addEventListener("click", () => {
      if (histMenu.hidden) openHistory();
      else closeHistory();
    });
  }

  if (histClear) {
    histClear.addEventListener("click", () => {
      history = [];
      persistHistory();
      endPreview();
      renderHistory();
    });
  }

  // 点击菜单外 / 按 Esc → 关闭下拉（并还原预览）
  document.addEventListener("mousedown", (ev) => {
    if (!histMenu || histMenu.hidden) return;
    if (histWrap && histWrap.contains(ev.target)) return;
    closeHistory();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && histMenu && !histMenu.hidden) {
      closeHistory();
      editor.focus();
    }
  });

  // 指针在两个面板之间移动时保持预览对照；离开面板（工具栏 / 页面外）才延迟还原
  previewPanels.forEach((panel) => {
    panel.addEventListener("mouseover", () => {
      if (previewing) cancelEndPreview();
    });
    panel.addEventListener("mouseleave", (ev) => {
      if (!previewing || inKeepArea(ev.relatedTarget)) return;
      scheduleEndPreview();
    });
  });

  // 预览中点击 / 聚焦编辑器 → 先结束预览并还原原内容，避免误改历史条目的内容
  editor.addEventListener("focus", () => {
    if (previewing) endPreview();
  });

  // 失焦即记录一条历史（生成按钮 / Ctrl+Enter / 加载示例另有记录点）
  // 预览中的内容是临时替换进来的，不作为用户输入记录
  editor.addEventListener("blur", () => {
    if (previewing) return;
    pushHistory(editor.value);
  });

  /* ---------- 初始化 ---------- */
  history = loadHistory();
  editor.value = C.buildSample(state.unit); // 默认 2 空格示例
  state.nodes = C.parseText(editor.value, state.unit);
  applyI18n(); // 应用界面语言：静态文案 + 动态文案 + 历史列表 + 预览统计
  document.documentElement.classList.remove("i18n-pending"); // 移除防闪烁遮罩
})();
