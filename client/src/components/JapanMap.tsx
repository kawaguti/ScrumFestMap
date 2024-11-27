import { useMemo, useState } from "react";
import { prefectures } from "@/lib/prefectures";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventList } from "./EventList";
import type { Event } from "@db/schema";

interface JapanMapProps {
  events: Event[];
  selectedPrefecture: string | null;
  onPrefectureSelect: (prefectureId: string) => void;
}

export function JapanMap({ events, selectedPrefecture, onPrefectureSelect }: JapanMapProps) {
  const [showEventDialog, setShowEventDialog] = useState(false);

  const prefectureEvents = useMemo(() => {
    if (!selectedPrefecture) return [];
    return events.filter(event => 
      prefectures.find(p => p.id === selectedPrefecture)?.name === event.prefecture
    );
  }, [events, selectedPrefecture]);

  const getPrefectureColor = (prefectureId: string) => {
    const hasEvents = events.some(event => 
      prefectures.find(p => p.id === prefectureId)?.name === event.prefecture
    );
    
    if (selectedPrefecture === prefectureId) {
      return "hsl(222.2 47.4% 11.2%)";
    }
    return hasEvents ? "hsl(222.2 47.4% 40%)" : "hsl(222.2 47.4% 80%)";
  };

  const handlePrefectureClick = (prefectureId: string) => {
    onPrefectureSelect(prefectureId);
    setShowEventDialog(true);
  };

  return (
    <>
      <Card className="p-4">
        <svg
          viewBox="0 0 800 800"
          className="w-full h-full"
        >
          {/* SVG paths for Japan map would go here */}
          {/* This is a placeholder. You would need to add actual SVG paths for each prefecture */}
        </svg>
      </Card>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPrefecture && prefectures.find(p => p.id === selectedPrefecture)?.name}
              のイベント
            </DialogTitle>
          </DialogHeader>
          <EventList events={prefectureEvents} />
        </DialogContent>
      </Dialog>
    </>
  );
}
