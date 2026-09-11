/* Text2Tree · 本地预览静态服务器（可选）：node serve-local.mjs  然后访问 http://localhost:8899
   默认只监听 127.0.0.1（仅本机）；需要手机 / 局域网设备访问时用 HOST=0.0.0.0 启动，
   启动日志会打印可用的局域网地址。端口与监听地址都可用 PORT、HOST 环境变量覆盖。 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 8899);
const HOST = process.env.HOST || "127.0.0.1"; // 局域网访问：HOST=0.0.0.0

/** 本机可用的局域网 IPv4 地址（排除回环与 169.254 链路本地，并去重）。 */
const lanAddrs = () =>
  [
    ...new Set(
      Object.values(networkInterfaces())
        .flat()
        .filter(
          (i) =>
            i &&
            (i.family === "IPv4" || i.family === 4) &&
            !i.internal &&
            !i.address.startsWith("169.254.")
        )
        .map((i) => i.address)
    ),
  ];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const file = normalize(join(ROOT, pathname));
    if (!file.startsWith(normalize(ROOT))) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const st = await stat(file);
    if (!st.isFile()) {
      res.writeHead(404).end("Not Found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] || "application/octet-stream",
      // 本地预览始终读最新文件，免得改了 JS / CSS 还在跑浏览器缓存
      "Cache-Control": "no-store",
    });
    res.end(await readFile(file));
  } catch (err) {
    res.writeHead(404).end("Not Found");
  }
});

server.listen(PORT, HOST, () => {
  const allCards = HOST === "0.0.0.0" || HOST === "::";
  const addrs = [...new Set(allCards ? ["127.0.0.1", ...lanAddrs()] : [HOST])];
  console.log("Text2Tree 本地预览已启动：");
  for (const addr of addrs) {
    const local = addr === "127.0.0.1" || addr === "localhost";
    console.log(`  http://${addr}:${PORT}${local ? "（仅本机）" : "（同局域网设备可用）"}`);
  }
  console.log(`  监听 ${HOST}，端口/地址可用 PORT、HOST 环境变量覆盖`);
});
