import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, eventHistory, insertEventSchema } from "../db/schema";
import type { Event } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { validatePasswordStrength } from "./password-validation";
import { Octokit } from "@octokit/rest";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export function setupRoutes(app: Express) {
  // 最新の更新履歴を1件取得するエンドポイント
  app.get("/api/latest-update", async (req, res) => {
    try {
      const [latestUpdate] = await db
        .select({
          id: eventHistory.id,
          eventId: eventHistory.eventId,
          userId: eventHistory.userId,
          modifiedAt: eventHistory.modifiedAt,
          modifiedColumn: eventHistory.modifiedColumn,
          username: users.username,
          eventName: events.name,
        })
        .from(eventHistory)
        .leftJoin(users, eq(eventHistory.userId, users.id))
        .leftJoin(events, eq(eventHistory.eventId, events.id))
        .orderBy(desc(eventHistory.modifiedAt))
        .limit(1);

      res.json(latestUpdate || null);
    } catch (error) {
      console.error("Latest update fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch latest update",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/events", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false));

      // エラーログを追加
      console.log("Fetched events:", allEvents);

      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // パスワード変更エンドポイント
  app.post("/api/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "認証されていません" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "現在のパスワードと新しいパスワードの両方が必要です" });
    }

    try {
      // パスワード強度のチェック
      const validation = validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        return res.status(400).json({
          error: "パスワードが要件を満たしていません",
          details: validation.errors
        });
      }

      // 現在のパスワードを確認
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      const isCurrentPasswordValid = await crypto.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: "現在のパスワードが正しくありません" });
      }

      // 新しいパスワードをハッシュ化
      const hashedNewPassword = await crypto.hash(newPassword);

      // パスワードを更新
      const [updatedUser] = await db
        .update(users)
        .set({
          password: hashedNewPassword
        })
        .where(eq(users.id, req.user.id))
        .returning();

      res.json({ message: "パスワードが正常に更新されました" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({
        error: "パスワードの変更に失敗しました",
        details: error instanceof Error ? error.message : "不明なエラー"
      });
    }
  });

  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // バリデーションの追加
      const result = insertEventSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: result.error.issues.map((i: { message: string }) => i.message)
        });
      }

      // イベントの作成
      const [event] = await db
        .insert(events)
        .values({
          ...result.data,
          createdBy: req.user?.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(event);
    } catch (error) {
      console.error("Event creation error:", error);
      res.status(500).json({
        error: "Failed to create event",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false));

      const now = new Date();
      const upcomingEvents = allEvents.filter(
        (event) => new Date(event.date) > now
      );

      // Count events by prefecture
      const prefectureStats = allEvents.reduce((acc: Record<string, number>, event) => {
        acc[event.prefecture] = (acc[event.prefecture] || 0) + 1;
        return acc;
      }, {});

      // Count events by month
      const monthlyStats = allEvents.reduce((acc: Record<string, number>, event) => {
        const month = new Date(event.date).getMonth() + 1;
        const monthKey = `${month}月`;
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      }, {});

      res.json({
        totalEvents: allEvents.length,
        upcomingEvents: upcomingEvents.length,
        prefectureStats,
        monthlyStats,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // 管理者用エンドポイント
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/events", requireAdmin, async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .orderBy(desc(events.createdAt));
      res.json(allEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/admin/promote/:userId", requireAdmin, async (req, res) => {
    try {
      const [user] = await db
        .update(users)
        .set({ isAdmin: true })
        .where(eq(users.id, parseInt(req.params.userId)))
        .returning();

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to promote user" });
    }
  });

  // マイイベント取得
  app.get("/api/my-events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userEvents = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.createdBy, req.user.id),
            eq(events.isArchived, false)
          )
        )
        .orderBy(desc(events.date));

      res.json(userEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/admin/demote/:userId", requireAdmin, async (req, res) => {
    try {
      // 自分自身の権限は剥奪できないようにする
      if (parseInt(req.params.userId) === req.user?.id) {
        return res.status(400).json({ error: "Cannot demote yourself" });
      }

      const [user] = await db
        .update(users)
        .set({ isAdmin: false })
        .where(eq(users.id, parseInt(req.params.userId)))
        .returning();

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to demote user" });
    }
  });

  // イベントの更新エンドポイント
  app.put("/api/events/:eventId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const eventId = parseInt(req.params.eventId);

    try {
      // バリデーションの追加
      const result = insertEventSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: result.error.issues.map((i) => i.message),
        });
      }

      // イベントの存在確認
      const [existingEvent] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (!existingEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      // 変更されたフィールドを検出して履歴を記録
      type EventKey = keyof typeof existingEvent;
      const changedFields = Object.entries(result.data).filter(([key, value]) => {
        const typedKey = key as EventKey;

        // 日付の比較
        if (key === 'date') {
          const newDate = new Date(value as string | number | Date);
          const oldDate = new Date(existingEvent[typedKey] as string | number | Date);
          return newDate.toISOString() !== oldDate.toISOString();
        }

        // その他のフィールドの比較（nullと空文字列を同等として扱う）
        const oldValue = existingEvent[typedKey];
        if (typeof value === 'string' && typeof oldValue === 'string') {
          const normalizedOld = oldValue.trim() || null;
          const normalizedNew = (value as string).trim() || null;
          return normalizedOld !== normalizedNew;
        }

        return value !== existingEvent[typedKey];
      });

      // YouTubeプレイリストの変更を検出
      const newYoutubePlaylist = (req.body.youtubePlaylist || '').trim();
      const oldYoutubePlaylist = (existingEvent.youtubePlaylist || '').trim();
      if (newYoutubePlaylist !== oldYoutubePlaylist && (newYoutubePlaylist || oldYoutubePlaylist)) {
        changedFields.push(['youtubePlaylist', newYoutubePlaylist || null]);
      }

      // イベントの更新
      const [updatedEvent] = await db
        .update(events)
        .set({
          ...result.data,
          youtubePlaylist: req.body.youtubePlaylist || "",
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId))
        .returning();

      // 変更履歴の記録
      if (changedFields.length > 0) {
        for (const [column, newValue] of changedFields) {
          const oldValue = (existingEvent as any)[column];
          await db.insert(eventHistory).values({
            eventId: eventId,
            userId: req.user.id,
            modifiedColumn: column,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: String(newValue || ""),
          });
        }
      }

      res.json(updatedEvent);
    } catch (error) {
      console.error("Event update error:", error);
      res.status(500).json({
        error: "Failed to update event",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // イベント履歴取得エンドポイント
  app.get("/api/events/:eventId/history", async (req, res) => {
    const eventId = parseInt(req.params.eventId);

    try {
      // まずイベントの存在確認
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const history = await db
        .select({
          id: eventHistory.id,
          eventId: eventHistory.eventId,
          userId: eventHistory.userId,
          modifiedAt: eventHistory.modifiedAt,
          modifiedColumn: eventHistory.modifiedColumn,
          oldValue: eventHistory.oldValue,
          newValue: eventHistory.newValue,
          username: users.username,
          eventName: events.name,
        })
        .from(eventHistory)
        .leftJoin(users, eq(eventHistory.userId, users.id))
        .leftJoin(events, eq(eventHistory.eventId, events.id))
        .where(eq(eventHistory.eventId, eventId))
        .orderBy(desc(eventHistory.modifiedAt));

      // 履歴が空でも空の配列を返す
      res.json(history || []);
    } catch (error) {
      console.error("History fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch event history",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // イベントの削除エンドポイント
  app.delete("/api/events/:eventId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const eventId = parseInt(req.params.eventId);

    try {
      // イベントの存在確認と権限チェック
      const [existingEvent] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (!existingEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (existingEvent.createdBy !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this event" });
      }

      // 論理削除の実装
      const [deletedEvent] = await db
        .update(events)
        .set({
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId))
        .returning();

      res.json(deletedEvent);
    } catch (error) {
      console.error("Event deletion error:", error);
      res.status(500).json({
        error: "Failed to delete event",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // GitHub同期エンドポイント
  app.post("/api/admin/sync-github", requireAdmin, async (req, res) => {
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      console.log("Starting GitHub sync process with GitHub Apps token...");

      if (!githubToken) {
        console.error("GitHub Apps token is missing");
        return res.status(500).json({ error: "GitHub Apps token is not configured" });
      }

      // トークンの形式をチェック（値自体は表示しない）
      console.log("Token format check:", {
        length: githubToken.length,
        startsWithGitHub: githubToken.startsWith('github_pat_') || githubToken.startsWith('ghs_'),
        isDefined: typeof githubToken === 'string' && githubToken.length > 0
      });

      console.log("Initializing GitHub client with Apps token...");
      const octokit = new Octokit({
        auth: `Bearer ${githubToken}`,
        userAgent: 'ScrumFestMap v1.0',
        headers: {
          accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        baseUrl: 'https://api.github.com'
      });

      // イベント一覧の取得
      console.log("Fetching events from database...");
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));

      console.log(`Found ${allEvents.length} events to sync`);

      try {
        // マークダウンファイルの生成
        const markdownContent = generateMarkdown(allEvents);
        console.log("Generated markdown content length:", markdownContent.length);

        // GitHub APIの呼び出し（Single File access - all-events.md）
        console.log("Attempting to update all-events.md on GitHub...");

        // 現在のファイルの取得を試みる
        let currentFile;
        try {
          currentFile = await octokit.repos.getContent({
            owner: 'kawaguti',
            repo: 'ScrumFestMapViewer',
            path: 'all-events.md',
            ref: 'main'
          });
          console.log("Current file found on GitHub");
        } catch (error) {
          console.log("File does not exist yet or other error:", error);
        }

        // ファイルの更新または作成
        const response = await octokit.repos.createOrUpdateFileContents({
          owner: 'kawaguti',
          repo: 'ScrumFestMapViewer',
          path: 'all-events.md',
          message: `Update events list - ${new Date().toISOString()}`,
          content: Buffer.from(markdownContent).toString('base64'),
          branch: 'main',
          ...(currentFile && { sha: currentFile.data.sha })
        });

        console.log("GitHub API Response Status:", response.status);
        console.log("GitHub API Response:", JSON.stringify(response.data, null, 2));

        res.json({
          success: true,
          message: "Successfully synced with GitHub",
          details: {
            status: response.status,
            sha: response.data.content?.sha,
            url: response.data.content?.html_url
          }
        });
      } catch (githubError: any) {
        console.error("GitHub API error details:", githubError);
        // GitHubのエラーレスポンスをより詳細に解析
        const errorResponse = githubError.response?.data;
        const errorMessage = errorResponse?.message || 
          (githubError instanceof Error ? githubError.message : "Unknown GitHub API error");
        const errorStatus = githubError.status || errorResponse?.status || 'unknown status';

        console.error("Detailed error information:", {
          message: errorMessage,
          status: errorStatus,
          response: errorResponse
        });

        res.status(500).json({
          error: "Failed to sync with GitHub",
          details: `${errorMessage} (Status: ${errorStatus})`
        });
      }
    } catch (error) {
      console.error("Sync process error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to sync events",
        details: errorMessage
      });
    }
  });

  // ヘルパー関数: マークダウンの生成
  function generateMarkdown(allEvents: Event[]): string {
    const today = new Date();
    let markdown = `# イベント一覧\n\n`;
    markdown += `最終更新: ${today.toLocaleDateString('ja-JP')}\n\n`;

    // イベントを日付でソート
    const sortedEvents = [...allEvents].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedEvents.forEach(event => {
      markdown += `## ${event.name}\n\n`;
      markdown += `- 日付: ${new Date(event.date).toLocaleDateString('ja-JP')}\n`;
      markdown += `- 場所: ${event.prefecture}\n`;
      if (event.website) markdown += `- Webサイト: ${event.website}\n`;
      if (event.youtubePlaylist) markdown += `- YouTube: ${event.youtubePlaylist}\n`;
      if (event.description) markdown += `\n${event.description}\n`;
      markdown += '\n---\n\n';
    });

    return markdown;
  }
}