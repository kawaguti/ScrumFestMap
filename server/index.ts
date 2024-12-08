import express, { type Request, Response, NextFunction } from "express";
import { setupRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import { setupAuth } from "./auth";

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
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // エラーログ設定
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      console.error('Error:', err);
      next(err);
    });

    // リクエストログ設定
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

    // 認証設定を初期化
    await setupAuth(app);
    setupRoutes(app);

    const server = createServer(app);

    // エラーハンドリング
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('Server Error:', err);
      res.status(status).json({ message });
    });

    // Vite設定
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // サーバー起動
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server is running on port ${PORT}`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

startServer().catch((error) => {
  console.error('Critical server error:', error);
  process.exit(1);
});
