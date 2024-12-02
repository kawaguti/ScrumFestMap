import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
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
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventHistory, setEventHistory] = useState<Event[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  const prefectureEvents = events.filter(event => {
    if (!selectedPrefecture) return false;
    return event.prefecture === events.find(e => e.prefecture === event.prefecture)?.prefecture;
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setIsDialogOpen(false);
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">スクラムフェスマップ</h1>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-muted-foreground">
                {user.username}
              </span>
              <div className="flex items-center gap-2">
                {user.isAdmin && (
                  <Button variant="outline" asChild>
                    <Link href="/admin">管理者ダッシュボード</Link>
                  </Button>
                )}
                <Button variant="outline" onClick={() => logout()}>
                  ログアウト
                </Button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <div className="flex justify-end">
          {user ? (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>新規イベント登録</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] p-6 z-50">
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
          ) : (
            <Button asChild>
              <Link href="/auth">ログインしてイベントを登録</Link>
            </Button>
          )}
        </div>

        {(!isDialogOpen && !isEditing) && (
          <JapanMap
            events={events}
            selectedPrefecture={selectedPrefecture}
            onPrefectureSelect={setSelectedPrefecture}
          />
        )}

        <EventList
          events={selectedEvent 
            ? eventHistory
            : selectedPrefecture
              ? prefectureEvents
              : eventHistory}
          selectedEvent={selectedEvent}
          onEditStateChange={setIsEditing}
        />
      </div>
    </div>
  );
}
