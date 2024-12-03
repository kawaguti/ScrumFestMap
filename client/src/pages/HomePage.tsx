import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../hooks/useUser";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { JapanMap } from "@/components/JapanMap";
import { EventForm } from "@/components/EventForm";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
      <header className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold">スクラムフェスマップ</h1>
          </div>
          
          {/* モバイルメニューボタン */}
          <div className="sm:hidden w-full">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline" className="w-full flex items-center justify-between">
                  <span>メニュー</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <div className="p-6 space-y-6">
                  {user ? (
                    <>
                      <div className="text-lg font-medium text-center border-b pb-4">
                        {user.username}さん
                      </div>
                      <div className="space-y-4">
                        <Button className="w-full" onClick={() => setIsDialogOpen(true)}>
                          新規イベント登録
                        </Button>
                        <Button variant="outline" className="w-full" asChild>
                          <Link to="/my-events">マイイベント</Link>
                        </Button>
                        {user.isAdmin && (
                          <Button variant="outline" className="w-full" asChild>
                            <Link to="/admin">管理者ダッシュボード</Link>
                          </Button>
                        )}
                        <Button variant="outline" className="w-full" asChild>
                          <Link to="/auth?change_password=true">パスワード変更</Link>
                        </Button>
                        <Button variant="destructive" className="w-full" onClick={() => logout()}>
                          ログアウト
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button className="w-full" asChild>
                      <Link to="/auth">ログインしてイベントを登録</Link>
                    </Button>
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>

          {/* デスクトップメニュー */}
          <div className="hidden sm:flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {user.username}さん
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
                    <Link to="/my-events">マイイベント</Link>
                  </Button>
                  {user.isAdmin && (
                    <Button variant="outline" asChild>
                      <Link to="/admin">管理者ダッシュボード</Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link to="/auth?change_password=true">パスワード変更</Link>
                  </Button>
                  <Button variant="outline" onClick={() => logout()}>
                    ログアウト
                  </Button>
                </div>
              </>
            ) : (
              <Button asChild>
                <Link to="/auth">ログインしてイベントを登録</Link>
              </Button>
            )}
          </div>
        </div>

        {/* 表示期間選択 */}
        <div className="w-full sm:w-auto">
          <RadioGroup
            value={displayPeriod}
            onValueChange={(value: "all" | "upcoming") => setDisplayPeriod(value)}
            className="flex items-center justify-center sm:justify-start space-x-4 p-2 bg-muted/10 rounded-lg"
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