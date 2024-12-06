import { useState, useMemo, FC, PropsWithChildren, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import type { Layer } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "react-leaflet-markercluster/dist/styles.min.css";
import { prefectures, prefectureCoordinates } from "@/lib/prefectures";
import { japanGeoData } from "@/lib/japanGeoData";
import { EventList } from "./EventList";
import type { Event } from "@db/schema";

interface MarkerClusterGroupProps {
  chunkedLoading?: boolean;
  spiderfyOnMaxZoom?: boolean;
  animate?: boolean;
  maxClusterRadius?: number;
}

const MarkerClusterGroupWithChildren: FC<PropsWithChildren<MarkerClusterGroupProps>> = 
  MarkerClusterGroup as any;

interface JapanMapProps {
  events: Event[];
  selectedPrefecture: string | null;
  onPrefectureSelect: (prefectureId: string) => void;
}

export function JapanMap({ events, selectedPrefecture, onPrefectureSelect }: JapanMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventHistory, setEventHistory] = useState<Event[]>([]);

  // 直近のイベントを取得する関数
  const getUpcomingEvent = useMemo(() => {
    const now = new Date();
    return events
      .filter(event => new Date(event.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;
  }, [events]);

  // 初期表示時に直近のイベントを自動選択
  useEffect(() => {
    if (!selectedEvent && events.length > 0) {
      const upcomingEvent = getUpcomingEvent;
      if (upcomingEvent) {
        handleMarkerClick(upcomingEvent);
        // 該当する都道府県を選択
        const prefecture = prefectures.find(p => p.name === upcomingEvent.prefecture);
        if (prefecture) {
          onPrefectureSelect(prefecture.id);
        }
      }
    }
  }, [events]);

  const handleMarkerClick = (event: Event) => {
    setSelectedEvent(event);
    setEventHistory(prev => {
      const filtered = prev.filter(e => e.id !== event.id);
      return [event, ...filtered].slice(0, 3);
    });
  };

  const prefectureEvents = useMemo(() => {
    if (!selectedPrefecture) return [];
    const prefecture = prefectures.find(p => p.id === selectedPrefecture);
    return events.filter(event => event.prefecture === prefecture?.name);
  }, [events, selectedPrefecture]);

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

  const onEachFeature = (feature: any, layer: Layer) => {
    layer.on({
      click: () => {
        const prefId = feature.properties.id;
        onPrefectureSelect(prefId);
        setSelectedEvent(null);
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
            <MarkerClusterGroupWithChildren
              chunkedLoading
              spiderfyOnMaxZoom
              animate
              maxClusterRadius={30}
            >
              {events.map((event) => {
                const prefecture = prefectures.find(p => p.name === event.prefecture);
                if (!prefecture) return null;
                const coordinates = prefectureCoordinates[event.prefecture];
                if (!coordinates) return null;
                
                const isFutureEvent = new Date(event.date) > new Date();
                
                return (
                  <Marker 
                    key={event.id} 
                    position={coordinates}
                    eventHandlers={{
                      click: () => handleMarkerClick(event)
                    }}
                    icon={L.divIcon({
                      className: 'marker-container',
                      html: `
                        <div class="marker-pin-google ${isFutureEvent ? 'future-event' : 'past-event'}">
                          <div class="marker-head"></div>
                          <div class="marker-tail"></div>
                        </div>
                      `,
                      iconSize: [30, 42],
                      iconAnchor: [15, 42],
                      popupAnchor: [0, -42]
                    })}
                  >
                    <Popup>
                      <div className="space-y-2">
                        <h3 className="font-bold text-lg">{event.name}</h3>
                        <p className="text-sm text-muted-foreground">{event.prefecture}</p>
                        <p className="text-sm">{new Date(event.date).toLocaleDateString('ja-JP')}</p>
                        {event.description && (
                          <p className="text-sm mt-2 popup-description">{event.description}</p>
                        )}
                        {event.website && (
                          <a
                            href={event.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:text-blue-700 block"
                          >
                            イベントサイトへ
                          </a>
                        )}
                        {event.youtubePlaylist && event.youtubePlaylist.trim() !== "" && (
                          <a
                            href={event.youtubePlaylist}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:text-blue-700 mt-1 block"
                          >
                            録画を見る
                          </a>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroupWithChildren>
          </MapContainer>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          {selectedEvent 
            ? "選択されたイベント" 
            : selectedPrefecture 
              ? `${prefectures.find(p => p.id === selectedPrefecture)?.name}のイベント`
              : "最近選択したイベント"}
        </h2>
        <EventList
          events={selectedEvent 
            ? eventHistory
            : selectedPrefecture
              ? prefectureEvents
              : eventHistory}
          selectedEvent={selectedEvent}
        />
      </div>
    </div>
  );
}
