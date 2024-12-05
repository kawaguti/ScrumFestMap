import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Button } from "../components/ui/button";
import { Link, useLocation } from "wouter";
import { JapanMap } from "../components/JapanMap";
import { EventForm } from "../components/EventForm";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../components/ui/drawer";
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
  const { user, logout, error } = useUser();
  const [, setLocation] = useLocation();
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(null);
  const [displayPeriod, setDisplayPeriod] = useState<"all" | "upcoming">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (error) {
      console.error("User data fetch error:", error);
    }
  }, [error]);

  // ユーザー状態が変更された時の処理
  useEffect(() => {
    if (user) {
      console.log("User state updated:", user.username);
    }
  }, [user]);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  // イベントのフィルタリングと直近のイベントの選択
  const { filteredEvents, upcomingEvent } = useMemo(() => {
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    const filtered = displayPeriod === "all" 
      ? events 
      : events.filter(event => {
          const eventDate = new Date(event.date);
          return eventDate >= now && eventDate <= oneYearFromNow;
        });

    // 直近の未来のイベントを見つける
    const upcoming = events
      .filter(event => new Date(event.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    return { filteredEvents: filtered, upcomingEvent: upcoming };
  }, [events, displayPeriod]);

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const handleMobileMenuItemClick = (action: () => void) => {
    return () => {
      action();
    };
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b px-4 py-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent whitespace-nowrap">スクラムフェスマップ</h1>
          </div>
          
          {/* モバイルメニュー */}
          <div className="sm:hidden w-full">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="w-full flex items-center justify-between px-4 py-2 min-h-[44px]">
                  <span className="text-sm font-medium">
                    {user ? `${user.username}さん` : 'メニュー'}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-2"
                  >
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-[85vh] overflow-y-auto fixed inset-0 z-50 mt-16 bg-background">
                <DrawerHeader className="sticky top-0 bg-background z-10 border-b pb-4">
                  <DrawerTitle className="text-center text-lg font-semibold">
                    メニュー
                  </DrawerTitle>
                </DrawerHeader>
                <div className="px-4 py-6 space-y-3">
                  {user ? (
                    <>
                      <Button 
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 transition-colors" 
                        onClick={handleMobileMenuItemClick(() => setIsDialogOpen(true))}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        新規イベント登録
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleMobileMenuItemClick(() => setLocation('/my-events'))}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                        マイイベント
                      </Button>
                      {user.isAdmin && (
                        <Button 
                          variant="outline" 
                          className="w-full flex items-center justify-center gap-2"
                          onClick={handleMobileMenuItemClick(() => setLocation('/admin'))}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                            <path d="M12 2a10 10 0 1 1-10 10h10V2z" />
                            <circle cx="12" cy="12" r="6" />
                          </svg>
                          管理者ダッシュボード
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleMobileMenuItemClick(() => setLocation('/auth?change_password=true'))}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        パスワード変更
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-full flex items-center justify-center gap-2" 
                        onClick={handleMobileMenuItemClick(logout)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        ログアウト
                      </Button>
                    </>
                  ) : (
                    <Button 
                      className="w-full flex items-center justify-center gap-2"
                      onClick={handleMobileMenuItemClick(() => setLocation('/auth'))}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      ログインしてイベントを登録
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
                    <Link href="/my-events">マイイベント</Link>
                  </Button>
                  {user.isAdmin && (
                    <Button variant="outline" asChild>
                      <Link href="/admin">管理者ダッシュボード</Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link href="/auth?change_password=true">パスワード変更</Link>
                  </Button>
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
        {!isDialogOpen && !isDrawerOpen && (
          <JapanMap
            events={filteredEvents}
            selectedPrefecture={selectedPrefecture}
            onPrefectureSelect={setSelectedPrefecture}
            initialSelectedEvent={upcomingEvent}
          />
        )}
      </div>
    </div>
  );
}
