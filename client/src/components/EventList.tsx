import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Event, InsertEvent } from "@db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Edit2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventForm } from "@/components/EventForm";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface EventListProps {
  events: Event[];
  selectedEvent?: Event | null;
  onEditStateChange?: (editing: boolean) => void;
}

export function EventList({ events, selectedEvent, onEditStateChange }: EventListProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    onEditStateChange?.(!!editingEvent);
  }, [editingEvent, onEditStateChange]);

  const updateEventMutation = useMutation({
    mutationFn: async (data: InsertEvent & { id: number }) => {
      const response = await fetch(`/api/events/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "成功", description: "イベントを更新しました。" });
      setEditingEvent(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "イベントの更新に失敗しました。",
      });
    },
  });

  const sortedEvents = selectedEvent
    ? events
    : [...events].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        イベントが見つかりません。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedEvents.map((event) => (
        <Card 
          key={event.id}
          className={cn(
            selectedEvent?.id === event.id && "border-primary"
          )}>
          <CardHeader>
            <CardTitle>{event.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(event.date), "yyyy年M月d日(E) HH:mm", {
                locale: ja,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {event.description && (
              <p className="text-sm text-muted-foreground mb-4">
                {event.description}
              </p>
            )}
            <div className="flex items-center gap-2">
              {event.website && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => event.website && window.open(event.website, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Webサイトへ
                </Button>
              )}
              {event.createdBy === user?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => setEditingEvent(event)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  編集
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog 
        open={!!editingEvent} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingEvent(null);
            onEditStateChange?.(false);
          }
        }}
      >
        <DialogContent className="fixed inset-0 flex items-center justify-center">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-[500px] p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-2xl font-semibold">イベントの編集</DialogTitle>
            </DialogHeader>
            {editingEvent && (
              <EventForm
                defaultValues={editingEvent}
                onSubmit={async (data) => {
                  await updateEventMutation.mutateAsync({ ...data, id: editingEvent.id });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
