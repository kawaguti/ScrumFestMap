import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useLocation } from "wouter";
import type { Event, User } from "@db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Download, Trash2 } from "lucide-react";
import { generateEventMarkdown, downloadMarkdown } from "@/lib/eventMarkdown";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import SyncDebugPanel from "@/components/SyncDebugPanel";

async function fetchAllUsers(): Promise<User[]> {
  try {
    const response = await fetch("/api/admin/users", {
      credentials: "include",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("管理者権限が必要です");
      }
      throw new Error(`${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    console.log("Fetched users:", data);
    return data;
  } catch (error) {
    console.error("User data fetch error:", error);
    throw error;
  }
}

async function fetchAllEvents(): Promise<Event[]> {
  try {
    const response = await fetch("/api/admin/events", {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch events");
    }
    return response.json();
  } catch (error) {
    console.error("Event data fetch error:", error);
    throw error;
  }
}

export default function AdminPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ユーザーの認証状態確認
  useEffect(() => {
    if (!user) {
      setLocation("/auth");
      return;
    } 
    if (!user.isAdmin) {
      setLocation("/");
      return;
    }
  }, [user, setLocation]);

  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold text-red-500">アクセス権限がありません</h1>
        <p className="mt-4">このページは管理者のみがアクセスできます。</p>
      </div>
    );
  }

  // Mutations
  const promoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/promote`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to promote user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "成功",
        description: "管理者権限を付与しました。",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "管理者権限の付与に失敗しました。",
      });
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/demote`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to demote user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "成功",
        description: "管理者権限を剥奪しました。",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "管理者権限の剥奪に失敗しました。",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "イベントの削除に失敗しました");
      }

      return response.json();
    },
    onSuccess: (_, deletedEventId) => {
      queryClient.setQueryData<Event[]>(["admin", "events"], (oldEvents) => {
        if (!oldEvents) return [];
        return oldEvents.filter((event) => event.id !== deletedEventId);
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "削除完了",
        description: "イベントを削除しました。",
      });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: "削除エラー",
        description: error instanceof Error ? error.message : "イベントの削除に失敗しました。",
      });
    },
  });

  const { data: users = [], isLoading: isLoadingUsers, error: usersError } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAllUsers,
    enabled: !!user?.isAdmin,
    retry: false,
    refetchOnWindowFocus: true,
    onError: (error) => {
      console.error('Users fetch error:', error);
    }
  });

  const { data: events = [], isLoading: isLoadingEvents, error: eventsError } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: fetchAllEvents,
    enabled: !!user?.isAdmin,
    retry: false,
    refetchOnWindowFocus: true,
    onError: (error) => {
      console.error('Events fetch error:', error);
    }
  });

  console.log('Admin page data:', { 
    usersCount: users.length, 
    eventsCount: events.length,
    usersError,
    eventsError
  });

  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold text-red-500">アクセス権限がありません</h1>
        <p className="mt-4">このページは管理者のみがアクセスできます。</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
        <div className="flex items-center gap-4">
          <SyncDebugPanel />
          <Button variant="outline" onClick={() => setLocation("/")}>
            ホームへ戻る
          </Button>
        </div>
      </header>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ユーザー管理</CardTitle>
            <CardDescription>登録済みユーザー一覧</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>ユーザー名</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>管理者権限</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((targetUser) => (
                    <TableRow key={targetUser.id}>
                      <TableCell>{targetUser.id}</TableCell>
                      <TableCell>{targetUser.username}</TableCell>
                      <TableCell>{targetUser.email}</TableCell>
                      <TableCell>{targetUser.isAdmin ? "はい" : "いいえ"}</TableCell>
                      <TableCell>
                        {!targetUser.isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => promoteMutation.mutate(String(targetUser.id))}
                          >
                            管理者に昇格
                          </Button>
                        )}
                        {targetUser.isAdmin && targetUser.id !== user?.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => demoteMutation.mutate(String(targetUser.id))}
                          >
                            管理者権限を剥奪
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>イベント管理</CardTitle>
              <CardDescription>登録済みイベント一覧</CardDescription>
            </div>
            {events.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  const markdown = generateEventMarkdown(events);
                  downloadMarkdown(markdown, `all-events-${format(new Date(), "yyyyMMdd-HHmm")}.md`);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                マークダウンでダウンロード
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingEvents ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>イベント名</TableHead>
                    <TableHead>開催地</TableHead>
                    <TableHead>開催日</TableHead>
                    <TableHead>作成者</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.id}</TableCell>
                      <TableCell>{event.name}</TableCell>
                      <TableCell>{event.prefecture}</TableCell>
                      <TableCell>
                        {format(new Date(event.date), "yyyy年M月d日", { locale: ja })}
                      </TableCell>
                      <TableCell>
                        {users.find(u => u.id === event.createdBy)?.username || event.createdBy}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="hover:bg-destructive/90 transition-colors"
                          onClick={() => {
                            if (confirm("このイベントを削除してもよろしいですか？\nこの操作は取り消すことができません。")) {
                              deleteEventMutation.mutate(event.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          削除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}