import { type Express } from "express";
import { db } from "../db";
import { events, users } from "@db/schema";
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

  });
  app.put("/api/events/:eventId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // 作成者チェック
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, parseInt(req.params.eventId)))
        .limit(1);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (event.createdBy !== req.user?.id) {
        return res.status(403).json({ error: "Not authorized to edit this event" });
      }

      // イベントの更新
      const [updatedEvent] = await db
        .update(events)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(events.id, parseInt(req.params.eventId)))
        .returning();

      res.json(updatedEvent);
    } catch (error) {
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [event] = await db
        .insert(events)
        .values({
          ...req.body,
          createdBy: req.user?.id,
        })
        .returning();
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to create event" });
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

  app.delete("/api/admin/events/:eventId", requireAdmin, async (req, res) => {
    try {
      const [deletedEvent] = await db
        .delete(events)
        .where(eq(events.id, parseInt(req.params.eventId)))
        .returning();

      if (!deletedEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json(deletedEvent);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete event" });
    }
  });
}