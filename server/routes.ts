import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory, insertEventSchema } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import jwt from 'jsonwebtoken';

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

  constructor(appId: string, privateKey: string, owner: string, repo: string) {
    try {
      this.appId = appId;

      // 環境変数の\nを実際の改行に変換
      this.privateKey = this.formatPrivateKey(privateKey);
      this.owner = owner;
      this.repo = repo;

      console.log('GitHubFileUpdater initialized with:', {
        appId,
        owner,
        repo,
        privateKeyLength: this.privateKey.length,
        privateKeyLines: this.privateKey.split('\n').length,
        privateKeyStart: this.privateKey.substring(0, 50),
        privateKeyEnd: this.privateKey.substring(this.privateKey.length - 50),
        startsWithHeader: this.privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'),
        endsWithFooter: this.privateKey.endsWith('-----END RSA PRIVATE KEY-----\n')
      });
    } catch (error) {
      console.error('GitHubFileUpdater initialization error:', error);
      throw new Error(`GitHub認証の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private formatPrivateKey(key: string): string {
    console.log('Original private key:', {
      length: key.length,
      containsSlashN: key.includes('\\n'),
      firstChars: key.substring(0, 50),
      lastChars: key.substring(key.length - 50)
    });

    // Base64エンコードされているかチェック
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(key.replace(/[\r\n\s]/g, ''));
    if (isBase64) {
      try {
        key = Buffer.from(key, 'base64').toString('utf-8');
        console.log('Decoded Base64 key:', {
          length: key.length,
          firstChars: key.substring(0, 50),
          lastChars: key.substring(key.length - 50)
        });
      } catch (error) {
        console.error('Base64 decoding error:', error);
      }
    }

    // 環境変数の\nを実際の改行に変換し、余分な空白を削除
    let formattedKey = key
      .replace(/\\n/g, '\n')  // \n文字列を実際の改行に変換
      .split('\n')
      .map(line => line.trim()) // 各行の余分な空白を削除
      .filter(line => line.length > 0) // 空行を削除
      .join('\n');

    // 最後に改行を追加
    if (!formattedKey.endsWith('\n')) {
      formattedKey += '\n';
    }

    // プライベートキーのヘッダーとフッターを確認
    if (!formattedKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      formattedKey = '-----BEGIN RSA PRIVATE KEY-----\n' + formattedKey;
    }
    if (!formattedKey.includes('-----END RSA PRIVATE KEY-----')) {
      formattedKey = formattedKey + '-----END RSA PRIVATE KEY-----\n';
    }

    console.log('Formatted private key:', {
      length: formattedKey.length,
      lines: formattedKey.split('\n').length - 1,
      firstChars: formattedKey.substring(0, 50),
      lastChars: formattedKey.substring(formattedKey.length - 50),
      startsWithHeader: formattedKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'),
      endsWithFooter: formattedKey.endsWith('-----END RSA PRIVATE KEY-----\n')
    });

    // キーの形式を確認
    if (!formattedKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') || 
        !formattedKey.endsWith('-----END RSA PRIVATE KEY-----\n')) {
      console.error('Invalid private key format:', {
        startsCorrectly: formattedKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'),
        endsCorrectly: formattedKey.endsWith('-----END RSA PRIVATE KEY-----\n'),
        keyStart: formattedKey.substring(0, 50),
        keyEnd: formattedKey.substring(formattedKey.length - 50)
      });
      throw new Error('Invalid RSA private key format');
    }

    return formattedKey;
  }

  private generateJWT(): string {
    try {
      const now = Math.floor(Date.now() / 1000) - 30;
      const payload = {
        iat: now,
        exp: now + (10 * 60),
        iss: this.appId
      };

      console.log('Generating JWT with payload:', {
        ...payload,
        privateKeyInfo: {
          length: this.privateKey.length,
          lines: this.privateKey.split('\n').length,
          firstChars: this.privateKey.substring(0, 50),
          lastChars: this.privateKey.substring(this.privateKey.length - 50),
          startsWithHeader: this.privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'),
          endsWithFooter: this.privateKey.endsWith('-----END RSA PRIVATE KEY-----\n')
        }
      });

      const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
      console.log('JWT token generated successfully:', {
        tokenLength: token.length,
        tokenStart: token.substring(0, 50),
        tokenEnd: token.substring(token.length - 50)
      });

      return token;
    } catch (error) {
      console.error('JWT Generation Error:', error);
      throw new Error(`JWT生成エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getHeaders(): Headers {
    const headers = new Headers({
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${this.generateJWT()}`,
      'X-GitHub-Api-Version': '2022-11-28'
    });

    console.log('Request headers prepared:', {
      accept: headers.get('Accept'),
      authLength: headers.get('Authorization')?.length,
      version: headers.get('X-GitHub-Api-Version')
    });

    return headers;
  }

  public async updateAllEventsFile(newContent: string): Promise<GitHubUpdateResponse> {
    const filePath = 'all-events.md';
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}`;

    try {
      // 1. Get current file to obtain SHA
      console.log('Fetching current file from GitHub...');
      const fileResponse = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('File fetch failed:', {
          status: fileResponse.status,
          statusText: fileResponse.statusText,
          errorText,
          url,
          headers: Object.fromEntries(fileResponse.headers.entries())
        });
        throw new Error(`ファイル取得エラー (${fileResponse.status}): ${errorText}`);
      }

      const fileData = await fileResponse.json() as GitHubFileResponse;
      console.log('Current file fetched successfully:', {
        sha: fileData.sha,
        contentLength: fileData.content?.length
      });

      // 2. Update file
      console.log('Updating file on GitHub...');
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message: 'Update all-events.md',
          content: Buffer.from(newContent).toString('base64'),
          sha: fileData.sha
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('File update failed:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          errorText,
          url,
          headers: Object.fromEntries(updateResponse.headers.entries())
        });
        throw new Error(`ファイル更新エラー (${updateResponse.status}): ${errorText}`);
      }

      const result = await updateResponse.json() as GitHubUpdateResponse;
      console.log('File update succeeded:', {
        commitSha: result.commit.sha,
        fileUrl: result.content.html_url
      });

      return result;

    } catch (error) {
      console.error('GitHub API Error:', error);
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

  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    console.log("Starting GitHub sync process...");

    try {
      const githubAppId = process.env.GITHUB_APP_ID;
      const githubPrivateKey = process.env.GITHUB_PRIVATE_KEY;

      if (!githubAppId || !githubPrivateKey) {
        console.error("Missing GitHub credentials");
        return res.status(500).json({
          error: "GitHub認証情報が不足しています",
          details: "環境変数GITHUB_APP_IDとGITHUB_PRIVATE_KEYを設定してください"
        });
      }

      console.log('Creating GitHubFileUpdater instance...');
      const github = new GitHubFileUpdater(
        githubAppId,
        githubPrivateKey,
        'kawaguti',
        'ScrumFestMapViewer'
      );

      console.log('Fetching events from database...');
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      console.log(`Found ${allEvents.length} events to sync`);
      const markdownContent = generateMarkdown(allEvents);

      console.log('Updating GitHub file...');
      const result = await github.updateAllEventsFile(markdownContent);

      console.log('Sync completed successfully:', {
        commitSha: result.commit.sha,
        url: result.content.html_url
      });

      res.json({
        success: true,
        message: "GitHubリポジトリにイベント一覧を同期しました",
        details: `更新されたファイル: ${result.content.html_url}`
      });

    } catch (error) {
      console.error('Sync process error:', error);
      res.status(500).json({
        error: "同期処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}