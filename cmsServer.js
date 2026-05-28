import http from "node:http";
import { createCmsApiHandler } from "./cmsApiCore.js";

const port = Number(process.env.CMS_PORT || 8787);
const host = process.env.CMS_HOST || "127.0.0.1";
const rootDir = process.env.CMS_ROOT_DIR || process.cwd();

const handler = createCmsApiHandler({ rootDir });

const server = http.createServer(async (req, res) => {
  const handled = await handler(req, res);
  if (handled) {
    return;
  }
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[artcomm-cms] API server listening on http://${host}:${port}`);
});
