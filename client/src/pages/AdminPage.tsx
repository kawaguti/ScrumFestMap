import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Download } from "lucide-react";
import { generateEventMarkdown, downloadMarkdown } from "@/lib/eventMarkdown";
import type { Event, User } from "@db/schema";

async function fetchAllUsers(): Promise<User[]> {
  const response = await fetch("/api/admin/users");
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  return response.json();
}

async function fetchAllEvents(): Promise<Event[]> {
  const response = await fetch("/api/admin/events");
  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }
  return response.json();
}

import { useToast } from "@/hooks/use-toast";

async function promoteToAdmin(userId: number) {
  const response = await fetch(`/api/admin/promote/${userId}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error("Failed to promote user");
  }
  return response.json();
}

async function demoteFromAdmin(userId: number) {
  const response = await fetch(`/api/admin/demote/${userId}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error("Failed to demote user");
  }
  return response.json();
}

export default function AdminPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const promoteMutation = useMutation({
    mutationFn: promoteToAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "成功",
        description: "ユーザーを管理者に昇格しました。",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "管理者への昇格に失敗しました。",
      });
    },
  });

  const demoteMutation = useMutation({
    mutationFn: demoteFromAdmin,
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

  // Redirect if user is not logged in or not admin
  useEffect(() => {
    if (!user) {
      setLocation("/auth");  // ユーザーが未ログインの場合は認証ページへ
    } else if (!user.isAdmin) {
      setLocation("/");  // 管理者権限がない場合はホームへ
    }
  }, [user, setLocation]);

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAllUsers,
    enabled: !!user?.isAdmin,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: fetchAllEvents,
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
        <Button variant="outline" onClick={() => setLocation("/")}>
          ホームへ戻る
        </Button>
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
                            onClick={() => promoteMutation.mutate(targetUser.id)}
                          >
                            管理者に昇格
                          </Button>
                        )}
                        {targetUser.isAdmin && targetUser.id !== user?.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => demoteMutation.mutate(targetUser.id)}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.id}</TableCell>
                      <TableCell>{event.name}</TableCell>
                      <TableCell>{event.prefecture}</TableCell>
                      <TableCell>
                        {new Date(event.date).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>
                        {users.find(u => u.id === event.createdBy)?.username || event.createdBy}
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
