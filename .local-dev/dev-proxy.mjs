#!/usr/bin/env node
/**
 * Dev-only proxy: one public tunnel for Metro + API.
 * /v1/*  -> API (3000)
 * else   -> Metro (8081)
 */
import http from "node:http";

const LISTEN = Number(process.env.PROXY_PORT || 8090);
const METRO = process.env.METRO_URL || "http://127.0.0.1:8081";
const API = process.env.API_URL || "http://127.0.0.1:3000";

function targetFor(urlPath) {
  return urlPath.startsWith("/v1/") || urlPath === "/v1" ? API : METRO;
}

const server = http.createServer((clientReq, clientRes) => {
  const base = targetFor(clientReq.url || "/");
  const upstream = new URL(clientReq.url || "/", base);

  const headers = { ...clientReq.headers, host: upstream.host };
  // Avoid sticky upstream keep-alive issues through ngrok
  delete headers["connection"];

  const proxyReq = http.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port,
      path: upstream.pathname + upstream.search,
      method: clientReq.method,
      headers
    },
    (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(clientRes);
    }
  );

  proxyReq.on("error", (err) => {
    clientRes.writeHead(502, { "content-type": "application/json" });
    clientRes.end(JSON.stringify({ message: `proxy_error: ${err.message}` }));
  });

  clientReq.pipe(proxyReq);
});

server.listen(LISTEN, "0.0.0.0", () => {
  console.log(`dev-proxy listening on :${LISTEN} (metro=${METRO}, api=${API})`);
});
