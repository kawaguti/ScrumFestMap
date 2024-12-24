import express, { type Request, Response, NextFunction } from "express";
import { setupRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";
import { createServer } from "http";
import { setupAuth } from "./auth.js";
import { db } from "../db/index.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function log(message: string, error?: any) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [express] ${message}`);
  if (error) {
    console.error(`${formattedTime} [express] Error:`, error);
  }
}

async function startServer() {
  try {
    log("Starting server initialization...");
    const app = express();
    const server = createServer(app);

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
        if (varName === 'GITHUB_PRIVATE_KEY') {
          log(`${varName} is set (length: ${value.length})`);
        } else {
          log(`${varName} is set`);
        }
      }
    });

    // データベース接続テスト
    try {
      log("Testing database connection...");
      await db.execute('SELECT 1');
      log("Database connection successful");
    } catch (dbError) {
      log("Database connection failed", dbError);
      throw dbError;
    }

    // 認証設定を初期化
    log("Setting up authentication...");
    setupAuth(app);
    log("Authentication setup complete");

    // APIルートを設定
    log("Setting up API routes...");
    setupRoutes(app);
    log("API routes setup complete");

    // エラーハンドリングミドルウェア
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      log("Server Error:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
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

    return new Promise((resolve) => {
      server.listen(Number(PORT), HOST, () => {
        log(`Server started in ${process.env.NODE_ENV || 'development'} mode`);
        log(`Listening on ${HOST}:${PORT}`);
        resolve(server);
      }).on('error', (error: any) => {
        log(`Failed to start server on port ${PORT}`, error);
        process.exit(1);
      });
    });
  } catch (error) {
    log("Fatal Startup Error", error);
    throw error;
  }
}

// サーバー起動
startServer().catch((error) => {
  log("Failed to start server", error);
  process.exit(1);
});