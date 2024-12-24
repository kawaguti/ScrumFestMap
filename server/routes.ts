import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory, insertEventSchema } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import jwt from 'jsonwebtoken';
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
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly deviceFlow: boolean;
  private deviceAuthService?: GitHubDeviceAuthService;

  constructor(appId: string, privateKey: string, owner: string, repo: string, deviceFlow = false) {
    try {
      this.appId = appId;
      this.privateKey = this.formatPrivateKey(privateKey);
      this.owner = owner;
      this.repo = repo;
      this.deviceFlow = deviceFlow;

      if (deviceFlow) {
        this.deviceAuthService = new GitHubDeviceAuthService({
          client_id: process.env.GITHUB_CLIENT_ID || ''
        });
      }

      addSyncDebugLog('info', 'GitHubFileUpdater initialized', {
        appId,
        owner,
        repo,
        deviceFlow,
        hasDeviceAuthService: !!this.deviceAuthService
      });
    } catch (error) {
      console.error('GitHubFileUpdater initialization error:', error);
      throw new Error(`GitHub認証の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private formatPrivateKey(key: string): string {
    try {
      addSyncDebugLog('info', 'Processing private key', {
        originalLength: key.length,
        containsSlashN: key.includes('\\n'),
        containsRealNewline: key.includes('\n')
      });

      // Remove any surrounding quotes
      key = key.replace(/^["']|["']$/g, '');

      // First, handle Base64 encoded keys
      if (/^[A-Za-z0-9+/=]+$/.test(key.replace(/[\r\n\s]/g, ''))) {
        try {
          const decodedKey = Buffer.from(key, 'base64').toString('utf-8');
          if (decodedKey.includes('-----BEGIN')) {
            key = decodedKey;
            addSyncDebugLog('info', 'Decoded Base64 key', {
              decodedLength: key.length,
              isValidFormat: key.includes('-----BEGIN')
            });
          }
        } catch (error) {
          addSyncDebugLog('error', 'Base64 decoding failed', { error });
        }
      }

      // Convert \n to real newlines and clean up the format
      let formattedKey = key
        .replace(/\\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

      // Ensure proper header and footer
      if (!formattedKey.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
        formattedKey = '-----BEGIN RSA PRIVATE KEY-----\n' + formattedKey;
      }
      if (!formattedKey.includes('-----END RSA PRIVATE KEY-----')) {
        formattedKey += '\n-----END RSA PRIVATE KEY-----';
      }
      if (!formattedKey.endsWith('\n')) {
        formattedKey += '\n';
      }

      addSyncDebugLog('info', 'Private key formatted', {
        finalLength: formattedKey.length,
        lineCount: formattedKey.split('\n').length,
        hasValidHeader: formattedKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'),
        hasValidFooter: formattedKey.includes('-----END RSA PRIVATE KEY-----'),
        endsWithNewline: formattedKey.endsWith('\n')
      });

      return formattedKey;

    } catch (error) {
      addSyncDebugLog('error', 'Private key formatting failed', { error });
      throw new Error(`Failed to format private key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateJWT(): string {
    try {
      const currentTime = Math.floor(Date.now() / 1000);

      const payload = {
        iat: currentTime - 30,     // 現在時刻から30秒前
        exp: currentTime + 600,    // 現在時刻から10分後
        iss: this.appId.toString() // GitHub App ID
      };

      // Device Flow用の追加クレーム
      if (this.deviceFlow) {
        Object.assign(payload, {
          sub: this.appId.toString()  // Device Flow時は必要
        });
      }

      addSyncDebugLog('info', 'Generating JWT', {
        timeInfo: {
          currentTimestamp: currentTime,
          currentTimeISO: new Date(currentTime * 1000).toISOString(),
          iatTimeISO: new Date(payload.iat * 1000).toISOString(),
          expTimeISO: new Date(payload.exp * 1000).toISOString()
        }
      });

      const token = jwt.sign(payload, this.privateKey, {
        algorithm: 'RS256',
        header: {
          typ: 'JWT',
          alg: 'RS256'
        }
      });

      addSyncDebugLog('info', 'JWT token generated', {
        tokenLength: token.length,
        decodedHeader: JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString()),
        decodedPayload: JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      });

      return token;

    } catch (error) {
      addSyncDebugLog('error', 'JWT generation failed', { error });
      throw new Error(`JWT generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getHeaders(): Headers {
    const token = this.generateJWT();
    const headers = new Headers({
      'Accept': 'application/vnd.github.v3+json',  // v3を明示的に指定
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'ScrumFestMap-GitHub-App',
      'X-GitHub-Api-Version': '2022-11-28'
    });

    // Device Flow が有効な場合、追加ヘッダー
    if (this.deviceFlow) {
      headers.append('X-GitHub-Device-Flow', 'true');
    }

    addSyncDebugLog('info', 'Request headers prepared', {
      headers: Object.fromEntries(headers.entries())
    });

    return headers;
  }

  public async updateAllEventsFile(newContent: string): Promise<GitHubUpdateResponse> {
    const filePath = 'all-events.md';
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}`;

    try {
      addSyncDebugLog('info', 'Starting file update', { url });

      // Device Flow認証が有効な場合は、認証フローを開始
      if (this.deviceFlow && this.deviceAuthService) {
        const deviceFlow = await this.deviceAuthService.startDeviceFlow();
        addSyncDebugLog('info', 'Device Flow started', {
          verificationUri: deviceFlow.verificationUri,
          userCode: deviceFlow.userCode,
          expiresIn: deviceFlow.expiresIn
        });

        // トークンを取得するまでポーリング
        let token = '';
        while (!token) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機
          token = await this.deviceAuthService.pollForToken();
        }

        addSyncDebugLog('info', 'Device Flow authentication successful', {
          tokenLength: token.length
        });
      }

      // Get current file
      const fileResponse = await fetch(url, {
        headers: this.deviceFlow && this.deviceAuthService
          ? this.deviceAuthService.getHeaders()
          : this.getHeaders()
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        addSyncDebugLog('error', 'File fetch failed', {
          status: fileResponse.status,
          statusText: fileResponse.statusText,
          errorText,
          headers: Object.fromEntries(fileResponse.headers.entries())
        });
        throw new Error(`ファイル取得エラー (${fileResponse.status}): ${errorText}`);
      }

      const fileData = await fileResponse.json() as GitHubFileResponse;
      addSyncDebugLog('info', 'Current file fetched', {
        sha: fileData.sha,
        contentLength: fileData.content?.length
      });

      // Update file
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: this.deviceFlow && this.deviceAuthService
          ? this.deviceAuthService.getHeaders()
          : this.getHeaders(),
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
          errorText,
          headers: Object.fromEntries(updateResponse.headers.entries())
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

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "管理者権限が必要です" });
  }
  next();
}

export function setupRoutes(app: Express) {
  app.get("/api/events", async (req, res) => {
    try {
      console.log("Fetching events from database...");
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      console.log(`Found ${allEvents.length} events`);
      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({
        error: "イベントの取得に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー"
      });
    }
  });

  // デバッグログを取得するエンドポイント
  app.get("/api/admin/sync-debug-logs", requireAdmin, (req, res) => {
    res.json(syncDebugLogs);
  });

  // デバッグログをクリアするエンドポイント
  app.post("/api/admin/clear-sync-debug-logs", requireAdmin, (req, res) => {
    clearSyncDebugLogs();
    res.json({ message: "デバッグログをクリアしました" });
  });

  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    clearSyncDebugLogs();
    addSyncDebugLog('info', 'Starting GitHub sync process', {});

    try {
      const githubAppId = process.env.GITHUB_APP_ID;
      const githubPrivateKey = process.env.GITHUB_PRIVATE_KEY;

      if (!githubAppId || !githubPrivateKey) {
        addSyncDebugLog('error', 'Missing GitHub credentials', {
          hasAppId: !!githubAppId,
          hasPrivateKey: !!githubPrivateKey
        });
        return res.status(500).json({
          error: "GitHub認証情報が不足しています",
          details: "環境変数GITHUB_APP_IDとGITHUB_PRIVATE_KEYを設定してください"
        });
      }

      addSyncDebugLog('info', 'Creating GitHubFileUpdater', {
        appId: githubAppId,
        owner: 'kawaguti',
        repo: 'ScrumFestMapViewer',
        deviceFlow: true  // Device Flowを有効化
      });

      const github = new GitHubFileUpdater(
        githubAppId,
        githubPrivateKey,
        'kawaguti',
        'ScrumFestMapViewer',
        true  // Device Flowを有効化
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
      const result = await github.updateAllEventsFile(markdownContent);

      addSyncDebugLog('info', 'Sync completed', {
        commitSha: result.commit.sha,
        fileUrl: result.content.html_url
      });

      res.json({
        success: true,
        message: "GitHubリポジトリにイベント一覧を同期しました",
        details: `更新されたファイル: ${result.content.html_url}`,
        debugLogs: syncDebugLogs
      });

    } catch (error) {
      addSyncDebugLog('error', 'Sync process error', error);
      res.status(500).json({
        error: "同期処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : String(error),
        debugLogs: syncDebugLogs
      });
    }
  });
}