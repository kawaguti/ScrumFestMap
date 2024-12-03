import { useState, useMemo } from "react";
import { EventDashboard } from "@/components/EventDashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { JapanMap } from "@/components/JapanMap";
import { EventForm } from "@/components/EventForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  // 年度オプションの生成
  const yearOptions = [
    { id: "all", label: "全期間" },
    { id: "2023", label: "2023" },
    { id: "2024", label: "2024" },
  ];

  const handleYearChange = (yearId: string) => {
    if (yearId === "all") {
      // 全期間が選択された場合、他の選択をクリア
      setSelectedYears(["all"]);
    } else {
      setSelectedYears(prev => {
        const newSelection = prev.filter(y => y !== "all");
        if (newSelection.includes(yearId)) {
          return newSelection.filter(y => y !== yearId);
        } else {
          return [...newSelection, yearId];
        }
      });
    }
  };

  // イベントのフィルタリング
  const filteredEvents = useMemo(() => {
    if (selectedYears.includes("all") || selectedYears.length === 0) return events;
    
    return events.filter(event => {
      const eventYear = new Date(event.date).getFullYear().toString();
      return selectedYears.includes(eventYear);
    });
  }, [events, selectedYears]);

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
          <div className="flex items-center space-x-4">
            {yearOptions.map(option => (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={option.id}
                  checked={selectedYears.includes(option.id) || (option.id === "all" && selectedYears.length === 0)}
                  onCheckedChange={() => handleYearChange(option.id)}
                />
                <label
                  htmlFor={option.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
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
