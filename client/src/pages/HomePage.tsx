import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { JapanMap } from "@/components/JapanMap";
import { EventForm } from "@/components/EventForm";
import { EventList } from "@/components/EventList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Event, InsertEvent } from "@db/schema";

async function fetchEvents(): Promise<Event[]> {
  const response = await fetch("/api/events");
  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }
  return response.json();
}

async function createEvent(event: InsertEvent): Promise<Event> {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) {
    throw new Error("Failed to create event");
  }
  return response.json();
}

export default function HomePage() {
  const { user, logout } = useUser();
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">スクラムフェスマップ</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {user?.username}
          </span>
          <Button variant="outline" onClick={() => logout()}>
            ログアウト
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <JapanMap
            events={events}
            selectedPrefecture={selectedPrefecture}
            onPrefectureSelect={setSelectedPrefecture}
          />
        </div>

        <div className="space-y-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full">新規イベント登録</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新規イベント登録</DialogTitle>
              </DialogHeader>
              <EventForm
                onSubmit={async (data) => {
                  await createEventMutation.mutateAsync(data);
                }}
              />
            </DialogContent>
          </Dialog>

          <h2 className="text-xl font-semibold">最近のイベント</h2>
          <EventList
            events={events.filter(
              (event) => new Date(event.date) >= new Date()
            )}
          />
        </div>
      </div>
    </div>
  );
}
