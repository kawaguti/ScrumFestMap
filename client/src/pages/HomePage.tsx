import { useState, useMemo } from "react";
import { EventDashboard } from "@/components/EventDashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { JapanMap } from "@/components/JapanMap";
import { EventForm } from "@/components/EventForm";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
  const [displayPeriod, setDisplayPeriod] = useState<"all" | "upcoming">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  // イベントのフィルタリング
  const filteredEvents = useMemo(() => {
    if (displayPeriod === "all") return events;
    
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    return events.filter(event => {
      const eventDate = new Date(event.date);
      const now = new Date();
      return eventDate >= now && eventDate <= oneYearFromNow;
    });
  }, [events, displayPeriod]);

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-3xl font-bold">スクラムフェスマップ</h1>
          <RadioGroup
            value={displayPeriod}
            onValueChange={(value: "all" | "upcoming") => setDisplayPeriod(value)}
            className="flex items-center space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">全期間</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="upcoming" id="upcoming" />
              <Label htmlFor="upcoming">今後一年間</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.username}
              </span>
              <div className="flex items-center gap-2">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>新規イベント登録</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[650px] p-8">
                    <DialogHeader className="space-y-4 mb-8">
                      <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                        新規イベント登録
                      </DialogTitle>
                    </DialogHeader>
                    <EventForm
                      onSubmit={async (data) => {
                        await createEventMutation.mutateAsync(data);
                        setIsDialogOpen(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>
                <Button variant="outline" asChild>
                  <Link href="/my-events">マイイベント</Link>
                </Button>
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
          ) : (
            <Button asChild>
              <Link href="/auth">ログインしてイベントを登録</Link>
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-6">
        {!isDialogOpen && (
          <JapanMap
            events={filteredEvents}
            selectedPrefecture={selectedPrefecture}
            onPrefectureSelect={setSelectedPrefecture}
          />
        )}
      </div>
    </div>
  );
}