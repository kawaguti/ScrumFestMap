import type { Express } from "express";
import { setupAuth } from "./auth";
import { db } from "../db";
import { events, insertEventSchema } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express) {
  setupAuth(app);

  // Event routes
  // Statistics route
  app.get("/api/stats", async (req, res) => {
    try {
      const allEvents = await db.select().from(events);
      
      // Calculate statistics
      const totalEvents = allEvents.length;
      const upcomingEvents = allEvents.filter(e => new Date(e.date) > new Date()).length;
      const prefectureStats = allEvents.reduce((acc, event) => {
        acc[event.prefecture] = (acc[event.prefecture] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const monthlyStats = allEvents.reduce((acc, event) => {
        const month = new Date(event.date).toLocaleString('ja-JP', { month: 'long' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        totalEvents,
        upcomingEvents,
        prefectureStats,
        monthlyStats
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Public endpoint - no authentication required
  app.get("/api/events", async (req, res) => {
    try {
      const allEvents = await db.select().from(events);
      res.json(allEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const result = insertEventSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input",
          details: result.error.issues
        });
      }

      const [event] = await db
        .insert(events)
        .values({
          ...result.data,
          createdBy: req.user.id,
        })
        .returning();
      res.json(event);
    } catch (error) {
      console.error('Event creation error:', error);
      res.status(500).json({ 
        error: "Failed to create event",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, parseInt(req.params.id)))
        .limit(1);

      if (!event || event.createdBy !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = insertEventSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input",
          details: result.error.issues
        });
      }

      const [updatedEvent] = await db
        .update(events)
        .set({
          ...result.data,
          updatedAt: new Date(),
        })
        .where(eq(events.id, parseInt(req.params.id)))
        .returning();

      res.json(updatedEvent);
    } catch (error) {
      console.error('Event update error:', error);
      res.status(500).json({ 
        error: "Failed to update event",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, parseInt(req.params.id)))
        .limit(1);

      if (!event || event.createdBy !== req.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await db
        .delete(events)
        .where(eq(events.id, parseInt(req.params.id)));

      res.json({ success: true });
    } catch (error) {
      console.error('Event deletion error:', error);
      res.status(500).json({ 
        error: "Failed to delete event",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Admin routes
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  };

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
      const allEvents = await db.select().from(events);
      res.json(allEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });
}
