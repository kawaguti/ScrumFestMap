import express, { type Request, Response, NextFunction } from "express";
import { setupRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import { setupAuth } from "./auth";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [express] ${message}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 環境変数の設定確認
const isDevelopment = process.env.NODE_ENV !== "production";
log(`Environment: ${process.env.NODE_ENV || "development"}`);
log(`Database URL: ${process.env.DATABASE_URL ? "configured" : "missing"}`);

// 認証設定を初期化
setupAuth(app);

// リクエストロギングミドルウェア
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // APIルートを設定
    setupRoutes(app);
    const server = createServer(app);

    // エラーハンドリングミドルウェア
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error(`Error: ${message}`);
      res.status(status).json({ message });
    });

    if (isDevelopment) {
      log("Starting server in development mode");
      await setupVite(app, server);
    } else {
      log("Starting server in production mode");
      serveStatic(app);
    }

    const PORT = process.env.PORT || 5000;
    const HOST = '0.0.0.0';

    server.listen(Number(PORT), HOST, () => {
      log(`Server started in ${process.env.NODE_ENV || 'development'} mode`);
      log(`Listening on port ${PORT}`);
      if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        const replitUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        log(`Replit production URL: ${replitUrl}`);
      }
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
})();