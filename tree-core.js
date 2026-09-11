/* Text2Tree · tree-core.js
 * 纯逻辑核心：文本/Markdown/“/”展开解析 + 目录树文本渲染 + 折叠状态。
 * 无任何 DOM 依赖，浏览器(window.TreeCore)与 Node(module.exports) 通用。
 *
 * 缩进模型：
 *   - 层级只由【行首空白】决定：每级对应 2 个或 4 个空格（宽度取决于缩进符选项）。
 *   - “缩进符”可选 5 类：2空格 / 4空格 / “-” / “*” / “+”。
 *     “-”“*”“+” 是 Markdown 无序列表样式：只影响排版外观与项目符号，
 *     不参与分层 —— 符号本身不增加层级，层级仍看行首空格。
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

  // Markdown 无序列表项目符号（解析时统一剥除，不参与分层）
  const MD_MARKERS = "[-*+]";

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

  // 测量行首空白：返回 { depth 层级, rest 去除缩进后的剩余内容 }
  // 层级 = floor(空格数 / 单位宽度) + 制表符数；符号不参与计数。
  function splitIndent(line, unitRaw) {
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
    return { depth: Math.floor(spaces / width) + tabs, rest: line.slice(i) };
  }

  // 兼容旧名（已被 splitIndent 取代，保留以便外部使用）
  function measureIndent(run, unitRaw) {
    return splitIndent(run, unitRaw).depth;
  }

  // 剥掉一行内容最前面的 Markdown 项目符号（“- ”“* ”“+ ”，符号后需接空白或到行尾）
  // 返回 [是否命中, 去除符号后的内容]
  function stripMarker(rest) {
    const m = new RegExp("^(" + MD_MARKERS + ")(?:[ \\t]+(.*))?$").exec(rest);
    if (!m) return [false, rest];
    const label = (m[2] || "").trim();
    return [true, label];
  }

  // 把一整行行首缩进与项目符号从 from 单位换算为 to 单位（层级保持不变）。
  // 层级只看行首空格；换行时按 from.width 数出层级，剥掉旧符号，再按 to.width
  // 重排缩进并按 to.marker 决定是否添加 Markdown 项目符号。
  function reindentLine(line, fromRaw, toRaw) {
    const from = presetOf(fromRaw);
    const to = presetOf(toRaw);
    if (!line.trim()) return line; // 空行 / 纯空白行原样保留

    const width = from.width || DEFAULT_INDENT.length;
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
    const level = Math.floor(spaces / width) + tabs;

    let content = line.slice(i);
    const [, stripped] = stripMarker(content); // 剥掉旧符号，避免换算后重复
    content = stripped || "";
    if (!content.trim()) return ""; // 只剩符号的行丢弃

    const gap = " ".repeat(level * (to.width || DEFAULT_INDENT.length));
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
    return String(text).split("\n").map((line) => reindentLine(line, fromRaw, toRaw)).join("\n");
  }

  /* ---------- 解析 ---------- */

  /**
   * 把文本解析为一组顶层目录节点（数组）。
   * - 层级由行首空白决定：每 width 个空格为 1 级，制表符 1 级
   * - 行内 “/”“\” 同级展开：第一段为本层节点，其余段为其同级子节点
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

      const sp = splitIndent(line, unitRaw);
      const rest = sp.rest.trim();
      if (!rest) continue;

      let depth = sp.depth;
      let label = rest;
      // Markdown 无序列表：剥除行首项目符号（- / * / +），不增加层级
      const [, stripped] = stripMarker(rest);
      if (stripped !== rest) {
        label = stripped;
        if (!label) continue;
      }

      // 去掉尾部的路径分隔符，如 “src/” → “src”
      label = label.replace(/[\\/]+$/, "");
      if (!label) continue;

      const segs = label.split(/[\\/]+/).map((s) => s.trim()).filter(Boolean);
      if (!segs.length) continue;

      const head = insertNode(segs[0], depth);
      for (let i = 1; i < segs.length; i++) {
        insertNode(segs[i], depth + 1); // 其余段为 head 的同级子节点（插入点父级=head）
      }
      void head;
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

  // 顶层节点存在性
  function hasAny(nodes) {
    return !!(nodes && nodes.length);
  }

  // 示例结构：[缩进层级, 该行内容]
  const SAMPLE_TREE = [
    [0, "react-app"],
    [1, "config/webpack.config.js/version.js"],
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

  const SAMPLE = buildSample(DEFAULT_INDENT); // 默认（两个空格）示例

  return {
    DEFAULT_INDENT,
    PRESETS,
    presetOf,
    SAMPLE,
    buildSample,
    convertIndentUnits,
    makeNode,
    countNodes,
    expandAll,
    collapseAll,
    measureIndent,
    parseText,
    renderRows,
    rowsToText,
    hasAny,
    SYM_BRANCH,
    SYM_LAST,
    SYM_PIPE,
  };
});
