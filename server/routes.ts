
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

function generateMarkdown(events: Event[]): string {
  const now = new Date();
  let header = `# スクラムフェスマップ\n\n作成日時: ${format(now, "yyyy年MM月dd日 HH:mm", { locale: ja })}\n\n`;
  header += `- マップ: https://scrumfestmap.kawaguti.dev\n\n---\n\n`;

  const eventsList = events
    .filter(event => !event.isArchived)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(event => {
      let markdown = `## ${event.name}\n\n`;
      markdown += `- 開催地: ${event.prefecture}\n`;

      if (event.coordinates) {
        const coordinates = typeof event.coordinates === 'string' 
          ? event.coordinates.split(',').map(coord => coord.trim())
          : event.coordinates;

        if (Array.isArray(coordinates)) {
          const [lat, lng] = coordinates;
          markdown += `- 座標: \`[${lng}, ${lat}]\` (Leaflet形式)\n`;
        }
      } else {
        const prefCoords = prefectureCoordinates[event.prefecture];
        if (prefCoords) {
          const [lat, lng] = prefCoords;
          markdown += `- 座標: \`[${lng}, ${lat}]\` (Leaflet形式)\n`;
        } else {
          markdown += `- 座標: 未設定\n`;
        }
      }

      markdown += `- 開催日: ${format(new Date(event.date), "yyyy年MM月dd日(E)", { locale: ja })}\n\n`;

      if (event.description) {
        const paragraphs = event.description.trim().split(/\n\s*\n/);
        const formattedParagraphs = paragraphs.map((para, index) => {
          if (para.includes('\n- ')) {
            return para;
          }
          return index === 0
            ? para.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('  \n')
            : para.replace(/\s*\n\s*/g, ' ').trim();
        });

        markdown += formattedParagraphs.join('\n\n') + '\n';
      }

      if (event.website) {
        markdown += `\n- Webサイト: ${event.website}\n`;
      }

      if (event.youtubePlaylist && event.youtubePlaylist.trim() !== "") {
        markdown += `- 録画一覧: ${event.youtubePlaylist}\n`;
      }

      markdown += '\n---\n\n';
      return markdown;
    }).join('');

  return header + eventsList;
}
