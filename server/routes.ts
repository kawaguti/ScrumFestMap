import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory, insertEventSchema } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { GitHubDeviceAuthService } from './github-auth';

// デバッグ情報を保存するための配列
let syncDebugLogs: Array<{
  timestamp: string;
  type: 'info' | 'error';
  title: string;
  details: any;
}> = [];

// デバッグログをクリアする関数
function clearSyncDebugLogs() {
  syncDebugLogs = [];
}

// デバッグログを追加する関数
function addSyncDebugLog(type: 'info' | 'error', title: string, details: any) {
  syncDebugLogs.push({
    timestamp: new Date().toISOString(),
    type,
    title,
    details
  });
}

// 管理者権限チェックミドルウェア
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ 
      error: "管理者権限が必要です",
      status: 403
    });
  }
  next();
}

interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
}

interface GitHubUpdateResponse {
  content: {
    sha: string;
    html_url: string;
  };
  commit: {
    sha: string;
    url: string;
  };
}

class GitHubFileUpdater {
  private readonly owner: string;
  private readonly repo: string;
  private deviceAuthService: GitHubDeviceAuthService;

  constructor(clientId: string, owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
    this.deviceAuthService = new GitHubDeviceAuthService(clientId);
  }

  public async updateAllEventsFile(newContent: string): Promise<GitHubUpdateResponse> {
    const filePath = 'all-events.md';
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}`;

    try {
      addSyncDebugLog('info', 'Starting file update', { url });

      // Device Flow認証を開始
      const deviceFlow = await this.deviceAuthService.startDeviceFlow();
      addSyncDebugLog('info', 'Device Flow started', {
        verificationUri: deviceFlow.verification_uri,
        userCode: deviceFlow.user_code,
        expiresIn: deviceFlow.expires_in
      });

      // トークンを取得するまで待機
      const token = await this.deviceAuthService.waitForAuthentication();
      addSyncDebugLog('info', 'Device Flow authentication successful', {
        tokenLength: token.length
      });

      // 現在のファイルを取得
      const fileResponse = await fetch(url, {
        headers: this.deviceAuthService.getHeaders(token)
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        addSyncDebugLog('error', 'File fetch failed', {
          status: fileResponse.status,
          statusText: fileResponse.statusText,
          errorText
        });
        throw new Error(`ファイル取得エラー (${fileResponse.status}): ${errorText}`);
      }

      const fileData = await fileResponse.json() as GitHubFileResponse;
      addSyncDebugLog('info', 'Current file fetched', {
        sha: fileData.sha,
        contentLength: fileData.content?.length
      });

      // ファイルを更新
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: this.deviceAuthService.getHeaders(token),
        body: JSON.stringify({
          message: 'Update all-events.md',
          content: Buffer.from(newContent).toString('base64'),
          sha: fileData.sha
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        addSyncDebugLog('error', 'File update failed', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          errorText
        });
        throw new Error(`ファイル更新エラー (${updateResponse.status}): ${errorText}`);
      }

      const result = await updateResponse.json() as GitHubUpdateResponse;
      addSyncDebugLog('info', 'File update succeeded', {
        commitSha: result.commit.sha,
        fileUrl: result.content.html_url
      });

      return result;
    } catch (error) {
      addSyncDebugLog('error', 'GitHub API Error', error);
      throw error;
    }
  }
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

export function setupRoutes(app: Express) {
  // APIルートの設定
  app.get("/api/events", async (req, res) => {
    try {
      console.log("Fetching events from database...");
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      res.setHeader('Content-Type', 'application/json');
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

  // デバッグログを取得するエンドポイント
  app.get("/api/admin/sync-debug-logs", requireAdmin, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(syncDebugLogs);
  });

  // デバッグログをクリアするエンドポイント
  app.post("/api/admin/clear-sync-debug-logs", requireAdmin, (req, res) => {
    clearSyncDebugLogs();
    res.setHeader('Content-Type', 'application/json');
    res.json({ 
      message: "デバッグログをクリアしました",
      status: 200 
    });
  });

  // GitHub同期エンドポイント
  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    clearSyncDebugLogs();
    addSyncDebugLog('info', 'Starting GitHub sync process', {
      timestamp: new Date().toISOString()
    });

    try {
      const githubClientId = process.env.GITHUB_CLIENT_ID;

      if (!githubClientId) {
        addSyncDebugLog('error', 'Missing GitHub credentials', {
          hasClientId: !!githubClientId
        });

        return res.status(500).json({
          error: "GitHub認証情報が不足しています",
          details: "必要な環境変数が設定されていません",
          status: 500,
          debugLogs: syncDebugLogs
        });
      }

      // GitHubファイル更新インスタンスを作成
      const github = new GitHubFileUpdater(
        githubClientId,
        'kawaguti',
        'ScrumFestMapViewer'
      );

      addSyncDebugLog('info', 'Starting Device Flow authentication', {
        timestamp: new Date().toISOString()
      });

      // データベースからイベントを取得
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      addSyncDebugLog('info', 'Events fetched from database', {
        count: allEvents.length,
        timestamp: new Date().toISOString()
      });

      // マークダウンを生成
      const markdownContent = generateMarkdown(allEvents);

      addSyncDebugLog('info', 'Markdown generated', {
        contentLength: markdownContent.length,
        timestamp: new Date().toISOString()
      });

      // GitHubにファイルを更新
      const result = await github.updateAllEventsFile(markdownContent);

      addSyncDebugLog('info', 'Sync completed', {
        commitSha: result.commit.sha,
        fileUrl: result.content.html_url,
        timestamp: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: "GitHubリポジトリにイベント一覧を同期しました",
        details: `更新されたファイル: ${result.content.html_url}`,
        debugLogs: syncDebugLogs
      });

    } catch (error) {
      console.error('Sync error:', error);

      addSyncDebugLog('error', 'Sync process error', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : String(error),
        timestamp: new Date().toISOString()
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