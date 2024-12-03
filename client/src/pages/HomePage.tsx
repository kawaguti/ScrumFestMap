import { useState, useMemo } from "react";
import { EventDashboard } from "@/components/EventDashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { JapanMap } from "@/components/JapanMap";
import { EventForm } from "@/components/EventForm";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  // 年度オプションの生成
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: "all", label: "全期間" },
    { value: currentYear.toString(), label: `${currentYear}年度` },
    { value: (currentYear - 1).toString(), label: `${currentYear - 1}年度` },
    { value: (currentYear - 2).toString(), label: `${currentYear - 2}年度` },
    { value: (currentYear - 3).toString(), label: `${currentYear - 3}年度` },
  ];

  // イベントのフィルタリング
  const filteredEvents = useMemo(() => {
    if (selectedYear === "all") return events;
    
    return events.filter(event => {
      const eventYear = new Date(event.date).getFullYear();
      return eventYear.toString() === selectedYear;
    });
  }, [events, selectedYear]);

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
          <Select
            value={selectedYear}
            onValueChange={setSelectedYear}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="年度を選択" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4">
          {user && (
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
              <DialogContent className="sm:max-w-[500px]">
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
            events={filteredEvents}
            selectedPrefecture={selectedPrefecture}
            onPrefectureSelect={setSelectedPrefecture}
          />
        )}
      </div>
    </div>
  );
}
