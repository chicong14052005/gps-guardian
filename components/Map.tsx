import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Search, Layers, Map as MapIcon, Globe, Check } from 'lucide-react';
import { GPSData, SafeZone, RouteData } from '../types';

// Fix Leaflet default icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icon for current position
const CurrentPositionIcon = L.divIcon({
  className: 'current-position-marker',
  html: `
    <div style="position: relative; width: 20px; height: 20px;">
      <div style="position: absolute; width: 20px; height: 20px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(59,130,246,0.5);"></div>
      <div style="position: absolute; width: 20px; height: 20px; background: #3b82f6; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Component to invalidate size on mount and resize
const MapResizer: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately after mount
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Also invalidate on window resize
    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);

    // Invalidate again after a short delay to ensure tiles are loaded
    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
};

// Component to control map behavior
const MapController: React.FC<{ center: [number, number]; autoCenter: boolean }> = ({ center, autoCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (autoCenter) {
      map.flyTo(center, map.getZoom(), { duration: 0.5 });
    }
  }, [center, autoCenter, map]);

  return null;
};

// Component to handle map click events
const MapEvents: React.FC<{
  onClick: (lat: number, lng: number) => void;
  onDoubleClick: (lat: number, lng: number) => void;
}> = ({ onClick, onDoubleClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
    dblclick(e) {
      onDoubleClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

// Hover Tooltip Component
const MapHoverTooltip = () => {
  const [position, setPosition] = React.useState<{ lat: number, lng: number } | null>(null);
  const [screenPos, setScreenPos] = React.useState<{ x: number, y: number } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useMapEvents({
    mousemove(e) {
      // Clear existing timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Hide tooltip immediately on move
      setPosition(null);

      // Store screen position for rendering
      setScreenPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      }, 1500);
    },
    mouseout() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPosition(null);
    },
    mousedown() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPosition(null);
    }
  });

  if (!position || !screenPos) return null;

  // Render using Portal to avoid map container overflow/z-index issues
  return (
    <div
      className="fixed z-[2000] bg-black/75 backdrop-blur-sm text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full -mt-2 border border-white/20"
      style={{ left: screenPos.x, top: screenPos.y }}
    >
      <div className="font-mono">
        {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
      </div>
    </div>
  );
};

// Pinned location type
interface PinnedLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// Custom Search Component with Pin feature
const CustomSearchBar: React.FC<{
  sidebarLeft: number;
  pinnedLocations: PinnedLocation[];
  onPinLocation: (location: PinnedLocation) => void;
  onRemovePin: (id: string) => void;
}> = ({ sidebarLeft, pinnedLocations, onPinLocation, onRemovePin }) => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    const provider = new OpenStreetMapProvider();
    const results = await provider.search({ query });
    setResults(results);
    setIsSearching(false);
  };

  const handleSelect = (result: any) => {
    map.flyTo([result.y, result.x], 16);
    setResults([]);
    setQuery(result.label);
  };

  const handlePin = (result: any) => {
    const newPin: PinnedLocation = {
      id: Date.now().toString(),
      name: result.label,
      lat: result.y,
      lng: result.x
    };
    onPinLocation(newPin);
    map.flyTo([result.y, result.x], 16);
    setResults([]);
    setQuery('');
  };

  // Calculate search bar width: min 200px, max 200 + sidebarLeft
  const searchBarWidth = Math.max(200, 200 + sidebarLeft * 0.3);

  return (
    <div
      ref={searchRef}
      className="fixed top-4 z-[1000] transition-all duration-300"
      style={{
        left: sidebarLeft + 16,
        width: Math.min(searchBarWidth, 400),
        minWidth: 200,
      }}
    >
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm địa điểm..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg border border-white/20 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </form>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-xl border border-white/20 dark:border-gray-700 overflow-hidden max-h-60 overflow-y-auto">
          {results.map((result, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <button
                onClick={() => handleSelect(result)}
                className="flex-1 text-left dark:text-gray-200 truncate pr-2"
              >
                {result.label}
              </button>
              <button
                onClick={() => handlePin(result)}
                className="flex-shrink-0 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                title="Ghim vị trí"
              >
                📍
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pinned locations list */}
      {pinnedLocations.length > 0 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-xl border border-white/20 dark:border-gray-700 overflow-hidden max-h-40 overflow-y-auto">
          <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
            📌 Vị trí đã ghim ({pinnedLocations.length})
          </div>
          {pinnedLocations.map((pin) => (
            <div
              key={pin.id}
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <button
                onClick={() => map.flyTo([pin.lat, pin.lng], 16)}
                className="flex-1 text-left dark:text-gray-200 truncate pr-2 text-xs"
              >
                {pin.name.substring(0, 40)}...
              </button>
              <button
                onClick={() => onRemovePin(pin.id)}
                className="flex-shrink-0 p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-xs"
                title="Xóa ghim"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Custom Layer Switcher
const CustomLayerSwitcher: React.FC<{
  currentLayer: string;
  onLayerChange: (layer: string) => void;
}> = ({ currentLayer, onLayerChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const layers = [
    { id: 'osm', name: 'Bản đồ', icon: MapIcon, color: 'bg-blue-500' },
    { id: 'satellite', name: 'Vệ tinh', icon: Globe, color: 'bg-green-500' },
  ];

  return (
    <div ref={containerRef} className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg border border-white/20 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
      >
        <Layers className="w-5 h-5 text-gray-700 dark:text-gray-200" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-xl border border-white/20 dark:border-gray-700 overflow-hidden p-2 space-y-1">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => {
                onLayerChange(layer.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentLayer === layer.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                }`}
            >
              <div className={`w-8 h-8 rounded-lg ${layer.color} text-white flex items-center justify-center shadow-sm`}>
                <layer.icon className="w-4 h-4" />
              </div>
              <span>{layer.name}</span>
              {currentLayer === layer.id && <Check className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface MapComponentProps {
  gps: GPSData;
  zones: SafeZone[];
  routes: RouteData[];
  editingRouteId: string | null;
  settings: { darkMode?: boolean; autoCenter?: boolean; bufferRadius?: number };
  onMapClick: (lat: number, lng: number) => void;
  onMapDoubleClick?: (lat: number, lng: number) => void;
  onUpdateRoutePoint?: (routeId: string, index: number, lat: number, lng: number) => void;
  sidebarLeft?: number;
}

const Map: React.FC<MapComponentProps> = ({
  gps, zones, routes, editingRouteId, settings,
  onMapClick, onMapDoubleClick, onUpdateRoutePoint, sidebarLeft = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState('osm');
  const [pinnedLocations, setPinnedLocations] = useState<PinnedLocation[]>([]);

  const handlePinLocation = (location: PinnedLocation) => {
    setPinnedLocations(prev => [...prev, location]);
  };

  const handleRemovePin = (id: string) => {
    setPinnedLocations(prev => prev.filter(p => p.id !== id));
  };

  // Custom icon for pinned locations
  const PinnedIcon = L.divIcon({
    className: 'pinned-location-marker',
    html: `
      <div style="position: relative; width: 30px; height: 40px;">
        <svg viewBox="0 0 24 24" width="30" height="40" fill="#ef4444" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40]
  });

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0" style={{ minHeight: '100vh' }}>
      <MapContainer
        center={[gps.lat, gps.lng]}
        zoom={15}
        style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        zoomControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={false}
      >
        <ZoomControl position="bottomright" />

        {/* Layers */}
        {activeLayer === 'osm' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className={settings.darkMode ? 'map-tiles-dark' : ''}
          />
        ) : (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          />
        )}

        <CustomSearchBar
          sidebarLeft={sidebarLeft}
          pinnedLocations={pinnedLocations}
          onPinLocation={handlePinLocation}
          onRemovePin={handleRemovePin}
        />
        <CustomLayerSwitcher currentLayer={activeLayer} onLayerChange={setActiveLayer} />
        <MapHoverTooltip />

        {/* Critical: Invalidate size for proper rendering */}
        <MapResizer />
        <MapController center={[gps.lat, gps.lng]} autoCenter={settings.autoCenter} />
        <MapEvents onClick={onMapClick} onDoubleClick={onMapDoubleClick || (() => { })} />

        {/* Pinned Location Markers */}
        {pinnedLocations.map(pin => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={PinnedIcon}
          >
            <Popup>
              <div className="text-sm p-1 min-w-[200px]">
                <p className="font-bold text-gray-800 mb-2 text-base">📍 Vị trí đã ghim</p>
                <p className="text-gray-600 text-xs mb-1 break-words">{pin.name}</p>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <p className="text-gray-500 text-xs">
                    <span className="font-medium">Lat:</span> <span className="font-mono">{pin.lat.toFixed(5)}</span>
                  </p>
                  <p className="text-gray-500 text-xs">
                    <span className="font-medium">Lng:</span> <span className="font-mono">{pin.lng.toFixed(5)}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleRemovePin(pin.id)}
                  className="mt-3 w-full py-1.5 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium rounded-lg transition-colors"
                >
                  🗑️ Xóa ghim
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Current Position Marker */}
        <Marker position={[gps.lat, gps.lng]} icon={CurrentPositionIcon}>
          <Popup>
            <div className="text-sm p-1">
              <p className="font-bold text-gray-800 mb-2">📍 Vị trí hiện tại</p>
              <p className="text-gray-600">Lat: <span className="font-mono">{gps.lat.toFixed(5)}</span></p>
              <p className="text-gray-600">Lng: <span className="font-mono">{gps.lng.toFixed(5)}</span></p>
              <p className="text-gray-600">Tốc độ: <span className="font-bold">{gps.speed} km/h</span></p>
            </div>
          </Popup>
        </Marker>

        {/* Safe Zones */}
        {zones.filter(z => z.active).map(zone => (
          <Circle
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={zone.radius}
            pathOptions={{
              color: zone.color || '#10b981',
              fillColor: zone.color || '#34d399',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '5, 5'
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{zone.name}</p>
                <p>Bán kính: {zone.radius >= 1000 ? `${(zone.radius / 1000).toFixed(1)}km` : `${zone.radius}m`}</p>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Render all routes */}
        {routes.map(route => (
          <React.Fragment key={route.id}>
            {/* Route Buffer Zone (thick transparent line) */}
            {route.points.length > 1 && route.active && (
              <Polyline
                positions={route.points.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{
                  color: route.color,
                  weight: Math.max(settings.bufferRadius ? settings.bufferRadius * 0.2 : 20, 20),
                  opacity: 0.15,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            )}

            {/* Actual Route Line */}
            {route.points.length > 1 && (
              <Polyline
                positions={route.points.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{
                  color: route.color,
                  weight: editingRouteId === route.id ? 5 : 4,
                  dashArray: route.confirmed ? undefined : '10, 10',
                  opacity: route.active ? 1 : 0.5
                }}
              />
            )}

            {/* Route Point Markers - only show for editing route */}
            {editingRouteId === route.id && route.points.map((point, index) => (
              <Marker
                key={`route-${route.id}-${index}`}
                position={[point.lat, point.lng]}
                draggable={!!onUpdateRoutePoint}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    if (onUpdateRoutePoint) {
                      onUpdateRoutePoint(route.id, index, position.lat, position.lng);
                    }
                  }
                }}
                icon={L.divIcon({
                  className: 'route-point-marker',
                  html: `<div style="width: 24px; height: 24px; background: ${route.color}; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: grab;">${index + 1}</div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })}
              >
                <Popup>
                  <div className="text-sm text-center">
                    <p className="font-bold">Điểm số {index + 1}</p>
                    <p className="text-xs text-gray-500">Kéo thả để di chuyển</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </React.Fragment>
        ))}
      </MapContainer>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0.3; }
        }
        .map-tiles-dark {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
        .leaflet-container {
          height: 100% !important;
          width: 100% !important;
        }
      `}</style>
    </div>
  );
};

export default Map;