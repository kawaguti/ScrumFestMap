import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Bug } from "lucide-react";

interface DebugLog {
  timestamp: string;
  type: 'info' | 'error';
  title: string;
  details: any;
}

const DebugLogEntry = ({ log }: { log: DebugLog }) => (
  <div
    className={`p-4 rounded-lg ${
      log.type === 'error' ? 'bg-destructive/10' : 'bg-muted'
    }`}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="font-semibold">{log.title}</span>
      <span className="text-sm text-muted-foreground">
        {new Date(log.timestamp).toLocaleString('ja-JP')}
      </span>
    </div>
    <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-48">
      {JSON.stringify(log.details, null, 2)}
    </pre>
  </div>
);

const DebugContent = React.memo(({ 
  logs, 
  isLoading, 
  error 
}: {
  logs: DebugLog[];
  isLoading: boolean;
  error: Error | null;
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4">
        エラーが発生しました: {error instanceof Error ? error.message : String(error)}
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

  const { data: logs = [], isLoading, error } = useQuery<DebugLog[]>({
    queryKey: ['/api/admin/sync-debug-logs'],
    enabled: isOpen,
  });

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
          <DialogTitle>GitHub同期デバッグパネル</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <DebugContent 
            logs={logs}
            isLoading={isLoading}
            error={error as Error | null}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}