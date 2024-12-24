
import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { GitHubAppService } from './github-auth';

// デバッグ情報を保存するための配列
let syncDebugLogs: Array<{
  timestamp: string;
  type: 'info' | 'error';
  title: string;
  details: any;
}> = [];

function clearSyncDebugLogs() {
  syncDebugLogs = [];
}

function addSyncDebugLog(type: 'info' | 'error', title: string, details: any) {
  syncDebugLogs.push({
    timestamp: new Date().toISOString(),
    type,
    title,
    details
  });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ 
      error: "管理者権限が必要です",
      status: 403
    });
  }
  next();
}

export function setupRoutes(app: Express) {
  app.get("/api/events", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({
        error: "イベントの取得に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー",
        status: 500
      });
    }
  });

  app.get("/api/admin/sync-debug-logs", requireAdmin, (req, res) => {
    res.json(syncDebugLogs);
  });

  app.post("/api/admin/clear-sync-debug-logs", requireAdmin, (req, res) => {
    clearSyncDebugLogs();
    res.json({ 
      message: "デバッグログをクリアしました",
      status: 200 
    });
  });

  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    clearSyncDebugLogs();
    addSyncDebugLog('info', 'Starting GitHub sync process', {
      timestamp: new Date().toISOString()
    });

    try {
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = process.env.GITHUB_PRIVATE_KEY;
      const installationId = process.env.GITHUB_INSTALLATION_ID;

      if (!appId || !privateKey || !installationId) {
        throw new Error("GitHub App credentials are missing");
      }

      const github = new GitHubAppService(appId, privateKey, installationId);

      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      addSyncDebugLog('info', 'Events fetched from database', {
        count: allEvents.length
      });

      // マークダウンを生成
      const markdownContent = generateMarkdown(allEvents);

      addSyncDebugLog('info', 'Markdown generated', {
        contentLength: markdownContent.length
      });

      // GitHubにファイルを更新
      const result = await github.updateAllEventsFile(
        markdownContent,
        'kawaguti',
        'ScrumFestMapViewer',
        'all-events.md'
      );

      addSyncDebugLog('info', 'File update succeeded', {
        commitSha: result.commit.sha
      });

      return res.json({
        success: true,
        message: "GitHubリポジトリにイベント一覧を同期しました",
        commitSha: result.commit.sha,
        debugLogs: syncDebugLogs
      });

    } catch (error) {
      console.error('Sync error:', error);
      addSyncDebugLog('error', 'Sync process error', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : String(error)
      });

      return res.status(500).json({
        error: "同期処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : String(error),
        status: 500,
        debugLogs: syncDebugLogs
      });
    }
  });
}

function generateMarkdown(events: Event[]): string {
  const now = new Date();
  let markdown = `# スクラムフェスマップ\n\n`;
  markdown += `作成日時: ${now.toLocaleString('ja-JP')}\n\n---\n\n`;

  const sortedEvents = [...events].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  sortedEvents.forEach(event => {
    markdown += `## ${event.name}\n\n`;
    markdown += `- 開催日: ${new Date(event.date).toLocaleDateString('ja-JP')}\n`;
    markdown += `- 開催地: ${event.prefecture}\n`;
    if (event.website) markdown += `- Webサイト: ${event.website}\n`;
    if (event.youtubePlaylist) markdown += `- 録画一覧: ${event.youtubePlaylist}\n`;
    if (event.description) markdown += `\n${event.description}\n`;
    markdown += '\n---\n\n';
  });

  return markdown;
}
