import { useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import { prefectures, prefectureCoordinates } from "@/lib/prefectures";
import { japanGeoData } from "@/lib/japanGeoData";
import { Card } from "@/components/ui/card";
import { EventList } from "./EventList";
import type { Event } from "@db/schema";
import type { Layer } from "leaflet";

interface JapanMapProps {
  events: Event[];
  selectedPrefecture: string | null;
  onPrefectureSelect: (prefectureId: string) => void;
}

export function JapanMap({ events, selectedPrefecture, onPrefectureSelect }: JapanMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  const handleMarkerClick = (event: Event) => {
    setSelectedEvent(event);  // モーダルを表示せず、選択状態のみ更新
  };

  const prefectureEvents = useMemo(() => {
    if (!selectedPrefecture) return [];
    const prefecture = prefectures.find(p => p.id === selectedPrefecture);
    return events.filter(event => event.prefecture === prefecture?.name);
  }, [events, selectedPrefecture]);

  // スタイル設定
  const getFeatureStyle = (feature: any) => {
    const prefId = feature.properties.id;
    const prefecture = prefectures.find(p => p.id === prefId);
    const hasEvents = events.some(event => event.prefecture === prefecture?.name);
    
    return {
      fillColor: selectedPrefecture === prefId 
        ? "hsl(222.2 47.4% 11.2%)" 
        : hasEvents 
          ? "hsl(222.2 47.4% 40%)" 
          : "hsl(210 40% 96.1%)",
      weight: 1,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.7
    };
  };

  // クリックイベントハンドラ
  const onEachFeature = (feature: any, layer: Layer) => {
    layer.on({
      click: () => {
        const prefId = feature.properties.id;
        onPrefectureSelect(prefId);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Card className="p-4">
          <MapContainer
            center={[36.5, 138]}
            zoom={5}
            style={{ height: "70vh", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <GeoJSON
              data={japanGeoData}
              style={getFeatureStyle}
              onEachFeature={onEachFeature}
            />
            {events.map((event) => {
              const prefecture = prefectures.find(p => p.name === event.prefecture);
              if (!prefecture) return null;
              const coordinates = prefectureCoordinates[event.prefecture];
              if (!coordinates) return null;
              
              return (
                <Marker 
                  key={event.id} 
                  position={coordinates}
                  eventHandlers={{
                    click: () => handleMarkerClick(event)
                  }}
                >
                  <Popup>
                    <div>
                      <h3 className="font-bold">{event.name}</h3>
                      <p>{event.prefecture}</p>
                      <p>{new Date(event.date).toLocaleDateString('ja-JP')}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          {selectedEvent 
            ? "選択されたイベント" 
            : selectedPrefecture 
              ? `${prefectures.find(p => p.id === selectedPrefecture)?.name}のイベント`
              : "最近のイベント"
          }
        </h2>
        <EventList
          events={selectedEvent ? [selectedEvent] : prefectureEvents}
          selectedEvent={selectedEvent}
        />
      </div>
    </div>
  );
}
