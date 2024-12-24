import { useState, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Bug, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DebugLog {
  timestamp: string;
  type: 'info' | 'error';
  title: string;
  details: any;
}

const DebugLogEntry = memo(function DebugLogEntry({ log }: { log: DebugLog }) {
  return (
    <div
      className={`p-4 rounded-lg ${
        log.type === 'error' ? 'bg-destructive/10' : 'bg-muted'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {log.type === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
          <span className="font-semibold">{log.title}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {new Date(log.timestamp).toLocaleString('ja-JP')}
        </span>
      </div>
      <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-48">
        {JSON.stringify(log.details, null, 2)}
      </pre>
    </div>
  );
});

const DebugContent = memo(function DebugContent({ 
  logs, 
  isLoading, 
  error,
  isSyncing
}: {
  logs: DebugLog[];
  isLoading: boolean;
  error: Error | null;
  isSyncing: boolean;
}) {
  if (isLoading || isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'ログを読み込み中...' : 'GitHubと同期中...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4 space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p className="font-semibold">エラーが発生しました</p>
        </div>
        <p className="text-sm pl-7">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(80vh-8rem)] rounded-md border p-4">
      <div className="space-y-4">
        {logs.map((log, index) => (
          <DebugLogEntry key={index} log={log} />
        ))}
        {logs.length === 0 && (
          <div className="text-center text-muted-foreground">
            デバッグログはありません
          </div>
        )}
      </div>
    </ScrollArea>
  );
});

export function SyncDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, error } = useQuery<DebugLog[]>({
    queryKey: ['/api/admin/sync-debug-logs'],
    enabled: isOpen,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/sync-github', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || 'GitHubとの同期に失敗しました');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "同期完了",
        description: `GitHubリポジトリにイベント一覧を同期しました。${data.details ? `\n${data.details}` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sync-debug-logs'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "同期エラー",
        description: error instanceof Error ? error.message : "GitHubとの同期に失敗しました。",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sync-debug-logs'] });
    },
  });

  const handleSync = () => {
    if (syncMutation.isPending) return;
    syncMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bug className="h-4 w-4 mr-2" />
          デバッグパネル
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>GitHub同期デバッグパネル</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              GitHubと同期
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <DebugContent 
            logs={logs}
            isLoading={isLoading}
            error={error as Error | null}
            isSyncing={syncMutation.isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}