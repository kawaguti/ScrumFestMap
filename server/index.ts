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

// グレースフルシャットダウンの処理を追加
async function gracefulShutdown(server: any) {
  log("Received shutdown signal. Starting graceful shutdown...");

  return new Promise((resolve) => {
    server.close(async () => {
      log("Server closed. Cleaning up...");
      try {
        // データベース接続のクローズ
        try {
          await db.execute('SELECT 1');  // Final query to ensure connection is alive
          log("Database connection closed");
        } catch (err) {
          console.error("Error during database shutdown:", err);
        }
        resolve(true);
      } catch (err) {
        console.error("Error closing database connections:", err);
        resolve(false);
      }
    });

    // 既存の接続の完了を待つ（10秒後にタイムアウト）
    setTimeout(() => {
      log("Shutdown timeout reached. Forcing exit...");
      resolve(false);
    }, 10000);
  });
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

    // GitHub認証設定の詳細確認
    const requiredEnvVars = ['GITHUB_APP_ID', 'GITHUB_PRIVATE_KEY', 'GITHUB_INSTALLATION_ID'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

    log("Checking GitHub authentication variables...");
    requiredEnvVars.forEach(varName => {
      const value = process.env[varName];
      if (!value) {
        log(`Missing ${varName}`);
      } else {
        // Private keyの場合は長さのみログ出力
        if (varName === 'GITHUB_PRIVATE_KEY') {
          log(`${varName} is set (length: ${value.length})`);
        } else {
          log(`${varName} is set`);
        }
      }
    });

    if (missingEnvVars.length > 0) {
      log(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    } else {
      log("All GitHub authentication variables are configured correctly");
    }

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

    // シャットダウンシグナルのハンドリング
    process.on('SIGTERM', async () => {
      log("SIGTERM received");
      const success = await gracefulShutdown(server);
      process.exit(success ? 0 : 1);
    });

    process.on('SIGINT', async () => {
      log("SIGINT received");
      const success = await gracefulShutdown(server);
      process.exit(success ? 0 : 1);
    });

    // 未処理の例外をハンドリング
    process.on('uncaughtException', async (error) => {
      console.error("Uncaught Exception:", error);
      log("Critical error occurred. Starting graceful shutdown...");
      await gracefulShutdown(server);
      process.exit(1);
    });

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