import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { apiHandler } from "./feeds.mjs";

/*
 * The security headers come from vercel.json, the file production actually reads,
 * so a policy that would break the app breaks the browser tests here first.
 * Cache-Control is deliberately not applied locally: the service worker is what
 * these tests are about, and an immutable asset cache would let the HTTP cache
 * stand in for it.
 */
const RULES = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
).headers.map(({ source, headers }) => ({
  pattern: new RegExp(
    "^" + source.replace(/[.]/g, "\\.").replace(/[(][.][*][)]/g, ".*") + "$",
  ),
  headers: headers.filter((h) => h.key.toLowerCase() !== "cache-control"),
}));
const SECURITY = RULES.filter((r) => r.headers.length);

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  for (const rule of SECURITY)
    if (rule.pattern.test(req.path))
      for (const { key, value } of rule.headers) res.setHeader(key, value);
  next();
});
app.all("/api/feeds", apiHandler);
const dir = fileURLToPath(new URL("../web/", import.meta.url));
app.use(
  express.static(dir, {
    setHeaders(res, path) {
      if (path.endsWith("sw.js") || path.endsWith("index.html"))
        res.setHeader("Cache-Control", "no-cache");
    },
  }),
);
app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Unknown endpoint" });
  res.sendFile(dir + "index.html");
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () =>
  console.log(`PROHOR ready on 0.0.0.0:${port}`),
);
