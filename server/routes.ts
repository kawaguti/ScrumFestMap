import { type Express } from "express";
import { db } from "../db";
import { events, users, insertEventSchema } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

// Admin middleware
function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

export function setupRoutes(app: Express) {
  // イベント関連のエンドポイント
  app.get("/api/events", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false))
        .orderBy(desc(events.date));
      res.json(allEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // リクエストデータの検証
      const result = insertEventSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: result.error.issues 
        });
      }

      // イベントの作成
      const [event] = await db
        .insert(events)
        .values({
          ...result.data,  // 検証済みのデータを使用
          createdBy: req.user?.id,
        })
        .returning();

      res.json(event);
    } catch (error) {
      console.error('Event creation error:', error);
      res.status(500).json({ 
        error: "Failed to create event",
        message: error instanceof Error ? error.message : "Unknown error"
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
}