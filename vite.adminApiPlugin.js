import { createCmsApiHandler } from "./cmsApiCore.js";

export function adminApiPlugin() {
  return {
    name: "artcomm-admin-api",
    configureServer(server) {
      const rootDir = server.config.root || process.cwd();
      const handler = createCmsApiHandler({ rootDir });

      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handler(req, res);
          if (handled) {
            return;
          }
          next();
        } catch (error) {
          const message = error instanceof Error ? error.message : "internal_error";
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      });
    }
  };
}
