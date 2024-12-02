import { type Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, events, insertEventSchema } from "@db/schema";
import { eq, desc } from "drizzle-orm";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export function setupRoutes(app: Express) {
  app.get("/api/events", async (req, res) => {
    try {
      const allEvents = await db
        .select()
        .from(events)
        .where(eq(events.isArchived, false));
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
        .where(eq(events.createdBy, req.user.id))
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
        return res.status(403).json({ error: "Not authorized to update this event" });
      }

      // イベントの更新
      const [updatedEvent] = await db
        .update(events)
        .set({
          ...result.data,
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId))
        .returning();

      res.json(updatedEvent);
    } catch (error) {
      console.error("Event update error:", error);
      res.status(500).json({
        error: "Failed to update event",
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
}
