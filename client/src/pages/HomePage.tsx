import { useState } from "react";
import { EventDashboard } from "@/components/EventDashboard";
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.username}
              </span>
              <Button variant="outline" onClick={() => logout()}>
                ログアウト
              </Button>
            </>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/auth">ログイン</Link>
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <EventDashboard />
        
        <div className="flex justify-end">
          {user ? (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>新規イベント登録</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規イベント登録</DialogTitle>
                </DialogHeader>
                <EventForm
                  onSubmit={async (data) => {
                    await createEventMutation.mutateAsync(data);
                    setIsDialogOpen(false);  // 登録後にダイアログを閉じる
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

        {!isDialogOpen && (
          <JapanMap
            events={events}
            selectedPrefecture={selectedPrefecture}
            onPrefectureSelect={setSelectedPrefecture}
          />
        )}
      </div>
    </div>
  );
}
