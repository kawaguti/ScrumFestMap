import express, { type Request, Response, NextFunction } from "express";
import { setupRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import { setupAuth } from "./auth";
import { db } from "../db";
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

async function startServer() {
  try {
    log("Starting server initialization...");
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // 環境変数の設定確認
    const isDevelopment = process.env.NODE_ENV !== "production";
    log(`Environment: ${process.env.NODE_ENV || "development"}`);

    // データベース設定の確認
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    log("Database URL is configured");

    // データベース接続テスト
    try {
      log("Testing database connection...");
      await db.execute('SELECT 1');
      log("Database connection successful");
    } catch (dbError) {
      log("Database connection failed");
      console.error("Database Error:", dbError);
      throw dbError;
    }

    // 認証設定を初期化
    log("Setting up authentication...");
    setupAuth(app);
    log("Authentication setup complete");

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

    // APIルートを設定
    log("Setting up API routes...");
    setupRoutes(app);
    log("API routes setup complete");

    const server = createServer(app);

    // エラーハンドリングミドルウェア
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("Server Error:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({
        error: message,
        details: isDevelopment ? err.stack || "No stack trace available" : undefined,
        status
      });
    });

    // 開発/本番モードに応じたセットアップ
    if (isDevelopment) {
      log("Starting server in development mode");
      await setupVite(app, server);
    } else {
      log("Starting server in production mode");
      serveStatic(app);
    }

    const PORT = process.env.PORT || 5000;
    const HOST = '0.0.0.0';

    // サーバー起動
    return new Promise((resolve) => {
      server.listen(Number(PORT), HOST, () => {
        log(`Server started in ${process.env.NODE_ENV || 'development'} mode`);
        log(`Listening on port ${PORT}`);
        if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
          const replitUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
          log(`Replit production URL: ${replitUrl}`);
        }
        resolve(server);
      });
    });
  } catch (error) {
    console.error("Server startup error:", error);
    log(`Fatal Startup Error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// サーバー起動
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});