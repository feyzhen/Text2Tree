/* Text2Tree · tree-core.js
 * 纯逻辑核心：文本 / Markdown 列表解析 + 目录树文本渲染 + 折叠状态。
 * 无任何 DOM 依赖，浏览器(window.TreeCore)与 Node(module.exports) 通用。
 *
 * 缩进模型：
 *   - 层级只由【行首空白】决定：每级对应 2 个或 4 个空格（宽度取决于缩进符选项）。
 *   - “缩进符”可选 5 类：2空格 / 4空格 / “-” / “*” / “+”。
 *     “-”“*”“+” 是 Markdown 无序列表样式：只影响排版外观与项目符号，
 *     不参与分层 —— 符号本身不增加层级，层级仍看行首空格。
 *   - 行内 “/” 只是普通字符：整行（去首尾空白后）即节点名，并列关系一律换行书写。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TreeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_INDENT = "  "; // 默认缩进符：两个空格

  const SYM_BRANCH = "\u251C\u2500\u2500 "; // ├──
  const SYM_LAST = "\u2514\u2500\u2500 "; // └──
  const SYM_PIPE = "\u2502   "; // │（中间通栏）
  const SYM_BLANK = "    "; // 空通栏

  /* ---------- 缩进符预设 ---------- */

  // 缩进单位预设。key 即文本中实际使用的“字面单位”（空格串或符号）。
  // marker 非空时表示 Markdown 列表样式（符号仅装饰，层级仍由空格决定）。
  const PRESETS = {
    "  ": { label: "2 空格", width: 2, marker: "" },
    "    ": { label: "4 空格", width: 4, marker: "" },
    "-": { label: "-", width: 2, marker: "-" },
    "*": { label: "*", width: 2, marker: "*" },
    "+": { label: "+", width: 2, marker: "+" },
  };

  function presetOf(unitRaw) {
    if (unitRaw == null) unitRaw = DEFAULT_INDENT;
    const key = String(unitRaw);
    if (PRESETS[key]) return PRESETS[key];
    // 兼容：自定义空白串（如多个空格）按宽度换算为无符号样式
    if (/^ +$/.test(key)) return { label: key.length + " 空格", width: key.length, marker: "" };
    if (/^[-*+]$/.test(key)) return { label: key, width: 2, marker: key };
    return PRESETS[DEFAULT_INDENT];
  }

  /* ---------- 基础工具 ---------- */

  function makeNode(name, id, ckey) {
    return { name, children: [], collapsed: false, id, ckey };
  }

  // 统计某组节点（含子孙）的节点总数
  function countNodes(list) {
    let n = 0;
    for (const node of list) {
      n += 1;
      n += countNodes(node.children);
    }
    return n;
  }

  // 全部展开 / 全部折叠
  function expandAll(list) {
    for (const node of list) {
      node.collapsed = false;
      expandAll(node.children);
    }
  }
  function collapseAll(list) {
    for (const node of list) {
      node.collapsed = node.children.length > 0;
      collapseAll(node.children);
    }
  }

  /* ---------- 缩进测量 ---------- */

  // 扫描行首空白：返回 { len 空白字符数, level 层级, rest 去除缩进后的剩余内容 }
  // 层级 = floor(空格数 / 单位宽度) + 制表符数；Markdown 符号不参与计数。
  function scanIndent(line, unitRaw) {
    const width = presetOf(unitRaw).width || DEFAULT_INDENT.length;
    let i = 0;
    let spaces = 0;
    let tabs = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === " ") spaces++;
      else if (ch === "\t") tabs++;
      else break;
      i++;
    }
    return { len: i, level: Math.floor(spaces / width) + tabs, rest: line.slice(i) };
  }

  // 剥掉一行内容最前面的 Markdown 项目符号（“- ”“* ”“+ ”，符号后需接空白或到行尾）
  // 返回 [是否命中, 去除符号后的内容]
  const MD_MARKER_RE = /^([-*+])(?:[ \t]+(.*))?$/;
  function stripMarker(rest) {
    const m = MD_MARKER_RE.exec(rest);
    if (!m) return [false, rest];
    return [true, (m[2] || "").trim()];
  }

  // 把一整行行首缩进与项目符号从 from 单位换算为 to 单位（层级保持不变）。
  // 层级只看行首空格；换行时按 from.width 数出层级，剥掉旧符号，再按 to.width
  // 重排缩进并按 to.marker 决定是否添加 Markdown 项目符号。
  // 返回 null 表示该行只剩符号、应整行丢弃（由 convertIndentUnits 过滤）
  function reindentLine(line, fromRaw, toRaw) {
    const to = presetOf(toRaw);
    if (!line.trim()) return line; // 空行 / 纯空白行原样保留

    const sp = scanIndent(line, fromRaw);
    let content = sp.rest;
    const [, stripped] = stripMarker(content); // 剥掉旧符号，避免换算后重复
    content = stripped || "";
    if (!content.trim()) return null; // 只剩符号的行丢弃

    const gap = " ".repeat(sp.level * (to.width || DEFAULT_INDENT.length));
    const deco = to.marker ? to.marker + " " : "";
    return gap + deco + content;
  }

  // 将整段文本每行行首缩进从 from 单位换算为 to 单位（多行、空行、行尾换行均保留）
  function convertIndentUnits(text, fromRaw, toRaw) {
    const from = presetOf(fromRaw);
    const to = presetOf(toRaw);
    if (from.label === to.label && from.width === to.width && from.marker === to.marker) {
      return String(text);
    }
    return String(text)
      .split("\n")
      .map((line) => reindentLine(line, fromRaw, toRaw))
      .filter((line) => line !== null) // 只剩符号的空行在换算中被丢弃
      .join("\n");
  }

  /* ---------- 多行粘贴：整块对齐 ---------- */

  // 行首空白宽度：制表符按 width 折算为空格数
  function leadWidth(line, width) {
    const ws = /^[\t ]*/.exec(line)[0];
    let n = 0;
    for (const ch of ws) n += ch === "\t" ? width : 1;
    return n;
  }

  function gcdInt(a, b) {
    return b ? gcdInt(b, a % b) : a;
  }

  // 嗅探一段文本的缩进单位宽度：各行行首宽度的最大公约数；判断不出时回退 fallback
  function sniffIndentWidth(lines, fallback) {
    let g = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const w = leadWidth(line, fallback);
      if (!w) continue;
      g = g ? gcdInt(g, w) : w;
    }
    return g > 0 && g <= 8 ? g : fallback;
  }

  // 剥掉行首缩进与 Markdown 项目符号，只留正文
  function stripToBody(line) {
    const body = String(line).trim();
    const m = MD_MARKER_RE.exec(body);
    return m ? (m[2] || "").trim() : body;
  }

  /**
   * 把一段多行文本整块对齐到 baseLevel 级：首行落在 baseLevel，其余行保持相对层级差，
   * 并按目标缩进样式（toRaw）重写缩进与项目符号。空行原样保留（不补缩进、不补符号）。
   * 用于“在缩进后粘贴多行”：整块跟着当前行一起偏移，而不是只有第一行对齐。
   */
  function alignBlock(text, baseLevel, toRaw) {
    const raw = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    const lines = raw.split("\n");
    const to = presetOf(toRaw);
    const width = to.width || DEFAULT_INDENT.length;

    const srcW = sniffIndentWidth(lines, width);
    const levels = lines.map((l) => (l.trim() ? leadWidth(l, srcW) / srcW : null));
    const firstIdx = levels.findIndex((x) => x !== null);
    if (firstIdx === -1) return raw; // 整块都是空行 → 原样

    const base = levels[firstIdx];
    const deco = to.marker ? to.marker + " " : "";
    return lines
      .map((l, i) => {
        const lv = levels[i];
        if (lv === null) return ""; // 空行
        const body = stripToBody(l);
        if (!body) return ""; // 只剩符号的行按空行处理
        const target = Math.max(0, Number(baseLevel || 0) + Math.floor(lv - base + 1e-6));
        return " ".repeat(target * width) + deco + body;
      })
      .join("\n");
  }

  /* ---------- 解析 ---------- */

  /**
   * 把文本解析为一组顶层目录节点（数组）。
   * - 层级由行首空白决定：每 width 个空格为 1 级，制表符 1 级
   * - 行内 “/” 只是普通字符，不再展开：整行即一个节点名，并列关系请分行书写
   * - Markdown 无序列表：“- ”“* ”“+ ”（前面可有缩进）项目符号自动剥除，不参与分层
   * - 折叠状态以 collapseKey(ckey) 方式跨次解析保留
   */
  function parseText(text, unitRaw) {
    const raw = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    const lines = raw.split("\n");

    const virtual = makeNode("", -1, "");
    const lastAt = [virtual]; // 每一层最近节点：lastAt[d]
    let seq = 0;

    function insertNode(name, depth) {
      // depth<=0 一律作为顶层；否则挂在 lastAt[depth-1]
      // 最多允许在现有最深层级 +1 处挂载，避免“越级”产生空洞层级
      let d = depth;
      if (d > lastAt.length) d = lastAt.length;
      const parent = d <= 0 ? virtual : lastAt[d - 1];

      // 在同父下重复同名时附加序号以保证 ckey 稳定
      const same = parent.children.filter((c) => c.name === name).length;
      const ckey = parent.ckey + "/" + name + (same ? "#" + (same + 1) : "");

      const node = makeNode(name, ++seq, ckey);
      parent.children.push(node);

      if (d >= 0) {
        lastAt[d] = node;
        lastAt.length = d + 1;
      }
      return node;
    }

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line.trim()) continue;

      const sp = scanIndent(line, unitRaw);
      const rest = sp.rest.trim();
      if (!rest) continue;

      let depth = sp.level;
      let label = rest;
      // Markdown 无序列表：剥除行首项目符号（- / * / +），不增加层级
      const [, stripped] = stripMarker(rest);
      if (stripped !== rest) {
        label = stripped;
        if (!label) continue;
      }

      // 整行即节点名：行内 “/” 按普通字符保留（并列关系请分行书写）
      label = label.replace(/[\\/]+$/, ""); // 仅清掉行尾多余的分隔符，如 “src/” → “src”
      if (!label) continue;

      insertNode(label, depth);
    }

    return virtual.children;
  }

  /* ---------- 树形文本渲染 ---------- */

  /**
   * 渲染为可见行。
   * @param {Array}  nodes          顶层节点数组
   * @param {Object} opts           { ignoreCollapsed: boolean }
   * @returns {Array} rows          [{ prefix, conn, name, text, node }]
   */
  function renderRows(nodes, opts) {
    const ignore = !!(opts && opts.ignoreCollapsed);
    const rows = [];

    function visit(items, prefix, isRootLevel) {
      for (let i = 0; i < items.length; i++) {
        const node = items[i];
        const isLast = i === items.length - 1;
        const hasKids = node.children.length > 0;
        const collapsed = hasKids && node.collapsed && !ignore;
        const conn = isRootLevel ? "" : isLast ? SYM_LAST : SYM_BRANCH;
        const text = prefix + conn + node.name;
        rows.push({ prefix, conn, name: node.name, text, node, hasKids, collapsed });

        if (!hasKids) continue;
        if (collapsed) continue; // 折叠：整棵子树不输出

        const childPrefix = prefix + (isRootLevel ? "" : isLast ? SYM_BLANK : SYM_PIPE);
        visit(node.children, childPrefix, false);
      }
    }

    visit(nodes, "", true);
    return rows;
  }

  function rowsToText(rows) {
    return rows.map((r) => r.text).join("\n");
  }

  // 示例结构：[缩进层级, 该行内容]
  const SAMPLE_TREE = [
    [0, "react-app"],
    [1, "config"],
    [2, "webpack.config.js"],
    [2, "version.js"],
    [1, "pages"],
    [2, "home"],
    [2, "app"],
    [2, "help"],
    [3, "contact.js"],
    [3, "mail.js"],
    [1, "package.json"],
  ];

  // 按指定缩进单位生成示例内容（结果与页面“输出”一致）
  function buildSample(unitRaw) {
    const preset = presetOf(unitRaw);
    return SAMPLE_TREE.map(([lv, text]) => {
      const gap = " ".repeat(lv * (preset.width || DEFAULT_INDENT.length));
      const deco = preset.marker ? preset.marker + " " : "";
      return gap + deco + text;
    }).join("\n");
  }

  return {
    DEFAULT_INDENT,
    PRESETS,
    presetOf,
    buildSample,
    convertIndentUnits,
    alignBlock,
    sniffIndentWidth,
    scanIndent,
    makeNode,
    countNodes,
    expandAll,
    collapseAll,
    parseText,
    renderRows,
    rowsToText,
    SYM_BRANCH,
    SYM_LAST,
    SYM_PIPE,
  };
});
