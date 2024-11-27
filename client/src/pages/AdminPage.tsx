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
import { Loader2 } from "lucide-react";
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

export default function AdminPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Redirect if user is not admin
  useEffect(() => {
    if (user && !user.isAdmin) {
      setLocation("/");
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.isAdmin ? "はい" : "いいえ"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>イベント管理</CardTitle>
            <CardDescription>登録済みイベント一覧</CardDescription>
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
                      <TableCell>{event.createdBy}</TableCell>
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
