import { useState, useMemo, FC, PropsWithChildren } from "react";
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      <div className="md:col-span-2">
        <Card className="p-2 md:p-4 overflow-hidden relative">
          <div className="absolute bottom-4 md:bottom-6 right-2 md:right-4 z-[1000] flex flex-col gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const mapContainer = document.querySelector('.leaflet-container');
                if (mapContainer) {
                  const map = (mapContainer as any)._leaflet;
                  if (map) {
                    map.getMap().zoomIn();
                  }
                }
              }}
              className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 rounded-lg shadow-lg touch-manipulation select-none"
              aria-label="ズームイン"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const mapContainer = document.querySelector('.leaflet-container');
                if (mapContainer) {
                  const map = (mapContainer as any)._leaflet;
                  if (map) {
                    map.getMap().zoomOut();
                  }
                }
              }}
              className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 rounded-lg shadow-lg touch-manipulation select-none"
              aria-label="ズームアウト"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          <MapContainer
            center={[36.5, 138]}
            zoom={5}
            style={{ 
              height: "calc(70vh - env(safe-area-inset-bottom))",
              width: "100%",
              touchAction: "pan-x pan-y",
              WebkitOverflowScrolling: "touch",
              msOverflowStyle: "-ms-autohiding-scrollbar",
              overscrollBehavior: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              msUserSelect: "none",
              WebkitTapHighlightColor: "transparent",
              cursor: "grab",
              outline: "none"
            }}
            zoomControl={false}
            scrollWheelZoom={true}
            dragging={true}
            touchZoom={true}
            doubleClickZoom={true}
            bounceAtZoomLimits={false}
            closePopupOnClick={true}
            attributionControl={false}
            preferCanvas={true}
            maxBounds={[
              [20, 122], // Southwest coordinates
              [46, 154]  // Northeast coordinates
            ]}
            minZoom={4}
            maxZoom={10}
            zoomSnap={0.5}
            zoomDelta={0.5}
            wheelDebounceTime={100}
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
                const markerColor = isFutureEvent ? 'bg-primary' : 'bg-muted';
                
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
                        {event.website && (
                          <a
                            href={event.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:text-blue-700"
                          >
                            イベントサイトへ
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

      <div className="space-y-2 md:space-y-4 overflow-y-auto overscroll-contain max-h-[calc(40vh-2rem)] md:max-h-[70vh] scroll-smooth -mx-2 px-2">
        <h2 className="text-lg md:text-xl font-semibold sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 z-10">
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
