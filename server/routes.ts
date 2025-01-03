import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { prefectureCoordinates } from "../client/src/lib/prefectures";

import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc, gt } from "drizzle-orm";
import { GitHubAppService } from './github-auth';

// 同期状態の管理
const syncState = {
  lastSyncTime: null as Date | null,
  lastLoginTime: new Date()
};

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

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: "ログインが必要です",
      status: 401
    });
  }
  next();
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
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({
        error: "ユーザー情報の取得に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー",
        status: 500
      });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { username, email } = req.body;

      const updatedUser = await db.update(users)
        .set({
          username,
          email,
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser || updatedUser.length === 0) {
        return res.status(404).json({ error: "ユーザーが見つかりません" });
      }

      res.json(updatedUser[0]);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({
        error: "ユーザー情報の更新に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー"
      });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // 自分自身は削除できないようにする
      if (req.user?.id === userId) {
        return res.status(400).json({ error: "自分自身は削除できません" });
      }

      await db.delete(users).where(eq(users.id, userId));
      res.json({ message: "ユーザーを削除しました" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({
        error: "ユーザーの削除に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー"
      });
    }
  });

  app.get("/api/admin/events", requireAdmin, async (req, res) => {
    try {
      const allEvents = await db.select().from(events);
      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({
        error: "イベント情報の取得に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー",
        status: 500
      });
    }
  });
  
  app.post("/api/events", async (req, res) => {
    try {
      const eventData = {
        ...req.body,
        date: new Date(req.body.date),
        coordinates: req.body.coordinates?.trim() || null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const newEvent = await db.insert(events).values(eventData).returning();
      res.json(newEvent[0]);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({
        error: "イベントの作成に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー",
        status: 500
      });
    }
  });

  app.get("/api/events", async (req, res) => {
    try {
      console.log('[DEBUG] Fetching events from database');
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      console.log('[DEBUG] Found events:', allEvents.map(e => ({ id: e.id, name: e.name })));
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

  app.post("/api/admin/sync-github", requireAuth, async (req, res) => {
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
        .where(
          syncState.lastSyncTime 
            ? gt(eventHistory.modifiedAt, syncState.lastSyncTime)
            : gt(eventHistory.modifiedAt, syncState.lastLoginTime)
        )
        .orderBy(desc(eventHistory.modifiedAt));

      // 同期状態を更新
      syncState.lastSyncTime = new Date();

      // Generate commit message
      let commitMessage = 'Update all-events.md';
      if (lastEventChanges.length > 0) {
        const latestEvent = lastEventChanges[0];
        commitMessage = `Update: ${latestEvent.eventName}`;
        
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

  app.put("/api/events/:id", async (req, res) => {
    console.log('Updating event:', req.params.id, 'with data:', req.body);
    try {
      const eventId = parseInt(req.params.id, 10);
      const updatedEvent = await db.update(events)
        .set({
          name: req.body.name,
          prefecture: req.body.prefecture,
          date: new Date(req.body.date),
          website: req.body.website,
          description: req.body.description,
          youtubePlaylist: req.body.youtubePlaylist,
          coordinates: req.body.coordinates ? req.body.coordinates.trim() : null,
          updatedAt: new Date()
        })
        .where(eq(events.id, eventId));
      
      if (!updatedEvent || updatedEvent.rowCount === 0) {
          return res.status(404).json({ error: "Event not found", status: 404});
      }
      res.json({ message: "Event updated successfully", status: 200});
    } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).json({ error: "Failed to update event", details: error instanceof Error ? error.message : "Unknown error", status: 500 });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id, 10);
      await db.delete(events).where(eq(events.id, eventId));
      
      res.status(200).json({ 
        success: true,
        message: "イベントを削除しました"
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ 
        success: false,
        error: "イベントの削除に失敗しました",
        message: error instanceof Error ? error.message : "不明なエラー"
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