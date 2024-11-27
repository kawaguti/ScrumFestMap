import type { Express } from "express";
import { setupAuth } from "./auth";
import { db } from "../db";
import { events } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express) {
  setupAuth(app);

  // Event routes
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
      const [event] = await db
        .insert(events)
        .values({
          ...req.body,
          createdBy: req.user.id,
        })
        .returning();
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to create event" });
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

      const [updatedEvent] = await db
        .update(events)
        .set(req.body)
        .where(eq(events.id, parseInt(req.params.id)))
        .returning();

      res.json(updatedEvent);
    } catch (error) {
      res.status(500).json({ error: "Failed to update event" });
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
      res.status(500).json({ error: "Failed to delete event" });
    }
  });
}
