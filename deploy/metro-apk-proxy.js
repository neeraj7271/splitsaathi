#!/usr/bin/env node
/**
 * Serves APKs from deploy/ and reverse-proxies everything else to Metro.
 * Phones can reach this port (they already download APKs from it).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const LISTEN_PORT = Number(process.env.PROXY_PORT || 8099);
const METRO_HOST = process.env.METRO_HOST || "127.0.0.1";
const METRO_PORT = Number(process.env.METRO_PORT || 8088);
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname);

const MIME = {
  ".apk": "application/vnd.android.package-archive",
  ".html": "text/html",
  ".txt": "text/plain",
  ".json": "application/json"
};

function serveStatic(req, res, pathname) {
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(STATIC_DIR, safe === "/" ? "SplitSaathi-debug.apk" : safe);
  if (!filePath.startsWith(STATIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": fs.statSync(filePath).size,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function proxyToMetro(req, res) {
  const headers = { ...req.headers, host: `${METRO_HOST}:${METRO_PORT}` };
  const proxyReq = http.request(
    {
      hostname: METRO_HOST,
      port: METRO_PORT,
      path: req.url,
      method: req.method,
      headers
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Metro proxy error: ${err.message}. Is Metro running on ${METRO_PORT}?`);
  });
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || "/", `http://127.0.0.1:${LISTEN_PORT}`).pathname;
  const from = req.socket.remoteAddress || "?";
  console.log(`[${new Date().toISOString()}] ${from} ${req.method} ${req.url}`);
  if (pathname.endsWith(".apk") || pathname === "/" || pathname === "/SplitSaathi-debug.apk") {
    serveStatic(req, res, pathname === "/" ? "/SplitSaathi-debug.apk" : pathname);
    return;
  }
  proxyToMetro(req, res);
});

server.on("upgrade", (req, socket, head) => {
  const headers = { ...req.headers, host: `${METRO_HOST}:${METRO_PORT}` };
  const proxyReq = http.request({
    hostname: METRO_HOST,
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers
  });
  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        `\r\n\r\n`
    );
    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    if (head && head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });
  proxyReq.on("error", () => socket.destroy());
  proxyReq.end();
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`[proxy] APK+Metro on 0.0.0.0:${LISTEN_PORT} -> Metro ${METRO_HOST}:${METRO_PORT}`);
  console.log(`[proxy] static dir ${STATIC_DIR}`);
});
