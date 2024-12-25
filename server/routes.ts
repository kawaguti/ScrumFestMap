
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { prefectureCoordinates } from "../client/src/lib/prefectures";

import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { GitHubAppService } from './github-auth';

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

function checkGitHubConfig(): { isConfigured: boolean; message?: string } {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  const installationId = process.env.GITHUB_INSTALLATION_ID;

  if (!appId || !privateKey || !installationId) {
    return {
      isConfigured: false,
      message: "GitHub連携機能は現在利用できません。環境変数の設定が必要です。"
    };
  }

  return { isConfigured: true };
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
    const githubConfig = checkGitHubConfig();
    if (!githubConfig.isConfigured) {
      return res.status(503).json({
        error: "GitHub同期は現在利用できません",
        details: githubConfig.message,
        status: 503
      });
    }

    clearSyncDebugLogs();
    addSyncDebugLog('info', 'Starting GitHub sync process', {
      timestamp: new Date().toISOString()
    });

    try {
      const github = new GitHubAppService(
        process.env.GITHUB_APP_ID,
        process.env.GITHUB_PRIVATE_KEY,
        process.env.GITHUB_INSTALLATION_ID
      );

      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      addSyncDebugLog('info', 'Events fetched from database', {
        count: allEvents.length
      });

      const markdownContent = generateMarkdown(allEvents);

      addSyncDebugLog('info', 'Markdown generated', {
        contentLength: markdownContent.length
      });

      // Get latest event history entries since last sync
      const lastEventChanges = await db
        .select({
          eventName: events.name,
          modifiedColumn: eventHistory.modifiedColumn,
          modifiedAt: eventHistory.modifiedAt
        })
        .from(eventHistory)
        .innerJoin(events, eq(events.id, eventHistory.eventId))
        .orderBy(desc(eventHistory.modifiedAt))
        .limit(5);

      // Generate commit message
      let commitMessage = 'Update all-events.md';
      if (lastEventChanges.length > 0) {
        const changesSummary = lastEventChanges
          .map(change => `${change.eventName} (${change.modifiedColumn})`)
          .join(', ');
        commitMessage += `\n\n更新されたイベント:\n${changesSummary}`;
      }

      const result = await github.updateAllEventsFile(
        markdownContent,
        'kawaguti',
        'ScrumFestMapViewer',
        'all-events.md',
        commitMessage
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

  app.get("/api/events/download", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      const markdown = generateMarkdown(allEvents);
      const filename = `all-events-${format(new Date(), "yyyyMMdd-HHmm")}.md`;
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(markdown);
    } catch (error) {
      console.error("Error generating markdown:", error);
      res.status(500).json({
        error: "マークダウンの生成に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー",
        status: 500
      });
    }
  });
}

import { generateEventMarkdown } from "../client/src/lib/eventMarkdown";

function generateMarkdown(events: Event[]): string {
  return generateEventMarkdown(events, {
    includeMapLink: true,
    includeTimestamp: true
  });
}
