import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, SafeZone, GPSData, RouteData, SimulationState } from '../types';
import ZoneEditor from './ZoneEditor';
import DirectionPicker from './DirectionPicker';
import {
  Settings as SettingsIcon,
  Shield,
  Navigation,
  Activity,
  Plus,
  Trash2,
  Crosshair,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  PlayCircle,
  Edit3,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  StopCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface SidebarProps {
  gps: GPSData;
  settings: Settings;
  zones: SafeZone[];
  routes: RouteData[];
  editingRouteId: string | null;
  isConnected: boolean;
  simState: SimulationState;
  onSettingsChange: (s: Settings) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onAddZone: (zone: Partial<SafeZone>) => void;
  onUpdateZone: (id: string, zone: Partial<SafeZone>) => void;
  onRemoveZone: (id: string) => void;
  onToggleZone: (id: string) => void;
  // Route handlers
  onCreateRoute: () => void;
  onDeleteRoute: (routeId: string) => void;
  onSelectRoute: (routeId: string | null) => void;
  onToggleRoute: (routeId: string) => void;
  onConfirmRoute: (routeId?: string) => void;
  onClearRoutePoints: (routeId?: string) => void;
  onStartSimulation: (type: 'route' | 'intrusion' | 'static', direction?: number, speed?: number) => void;
  onStopSimulation: () => void;
  onLogout: () => void;
  onSidebarChange?: (width: number, isCollapsed: boolean) => void;
}

// Portal component for modals
const ModalPortal: React.FC<{ children: React.ReactNode; isOpen: boolean }> = ({ children, isOpen }) => {
  if (!isOpen) return null;
  return createPortal(
    <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', zIndex: 99999 }}>
      {children}
    </div>,
    document.body
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  gps, settings, zones, routes, editingRouteId, isConnected, simState,
  onSettingsChange, onConnect, onDisconnect, onAddZone, onUpdateZone,
  onRemoveZone, onToggleZone, onCreateRoute, onDeleteRoute, onSelectRoute,
  onToggleRoute, onConfirmRoute, onClearRoutePoints, onStartSimulation,
  onStopSimulation, onLogout, onSidebarChange
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'zones' | 'route' | 'settings'>('monitor');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const [showZoneEditor, setShowZoneEditor] = useState(false);
  const [editingZone, setEditingZone] = useState<SafeZone | null>(null);
  const [showDirectionPicker, setShowDirectionPicker] = useState(false);

  const suggestedSubnet = '192.168.1.';
  const isSimulationRunning = simState.isActive;

  // Resizing Logic
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX;
        if (newWidth >= 250 && newWidth <= 600) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Notify parent of sidebar changes
  useEffect(() => {
    if (onSidebarChange) {
      onSidebarChange(sidebarWidth, isCollapsed);
    }
  }, [sidebarWidth, isCollapsed, onSidebarChange]);

  const TabButton = ({ id, icon: Icon, label }: { id: typeof activeTab; icon: React.ElementType; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 flex flex-col items-center justify-center py-2 md:py-3 text-[10px] md:text-xs font-medium transition-colors ${activeTab === id
        ? 'text-primary bg-indigo-50 dark:bg-indigo-900/20 border-b-2 border-primary'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
    >
      <Icon className="w-4 h-4 md:w-5 md:h-5 mb-0.5 md:mb-1" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const handleAddNewZone = useCallback(() => {
    setEditingZone(null);
    setShowZoneEditor(true);
  }, []);

  const handleEditZone = useCallback((zone: SafeZone) => {
    setEditingZone(zone);
    setShowZoneEditor(true);
  }, []);

  const handleSaveZone = useCallback((zoneData: Partial<SafeZone>) => {
    if (editingZone) {
      onUpdateZone(editingZone.id, zoneData);
    } else {
      onAddZone({
        ...zoneData,
        lat: gps.lat,
        lng: gps.lng,
      });
    }
    setShowZoneEditor(false);
    setEditingZone(null);
  }, [editingZone, onUpdateZone, onAddZone, gps.lat, gps.lng]);

  const handleSimulateIntrusion = useCallback(() => {
    setShowDirectionPicker(true);
  }, []);

  const handleDirectionSelect = useCallback((direction: number, speed: number) => {
    setShowDirectionPicker(false);
    onStartSimulation('intrusion', direction, speed);
  }, [onStartSimulation]);

  const handleCloseZoneEditor = useCallback(() => {
    setShowZoneEditor(false);
    setEditingZone(null);
  }, []);

  const handleCloseDirectionPicker = useCallback(() => {
    setShowDirectionPicker(false);
  }, []);

  return (
    <>
      {/* Collapse Toggle Button - Fixed Z-Index & Position */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ left: isCollapsed ? '0px' : `${sidebarWidth}px` }}
        className="fixed top-1/2 -translate-y-1/2 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-r-lg p-2 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 z-[1100]"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" /> : <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />}
      </button>

      <aside
        className="h-full flex flex-col bg-white dark:bg-dark-card border-r border-gray-200 dark:border-gray-700 shadow-xl z-[1100] transition-all duration-300 overflow-hidden fixed left-0 top-0 bottom-0"
        style={{ width: isCollapsed ? '0px' : `${sidebarWidth}px` }}
      >
        {/* Resizer Handle */}
        {!isCollapsed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 z-[1101] transition-colors"
            onMouseDown={startResizing}
          />
        )}
        {/* Header */}
        <div className="p-3 md:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg text-white flex-shrink-0">
            <Activity className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base md:text-lg text-gray-900 dark:text-white leading-tight truncate">GPS Guardian</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <TabButton id="monitor" icon={Activity} label="Monitor" />
          <TabButton id="zones" icon={Shield} label="Zones" />
          <TabButton id="route" icon={Navigation} label="Route" />
          <TabButton id="settings" icon={SettingsIcon} label="Settings" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 md:space-y-6">

          {/* MONITOR TAB */}
          {activeTab === 'monitor' && (
            <div className="space-y-4 md:space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Current Status</h3>
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div className="p-2 md:p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <span className="text-[10px] md:text-xs text-gray-500 block">Latitude</span>
                    <span className="font-mono font-bold text-sm md:text-lg dark:text-white">{gps.lat.toFixed(5)}</span>
                  </div>
                  <div className="p-2 md:p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <span className="text-[10px] md:text-xs text-gray-500 block">Longitude</span>
                    <span className="font-mono font-bold text-sm md:text-lg dark:text-white">{gps.lng.toFixed(5)}</span>
                  </div>
                  <div className="col-span-2 p-2 md:p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] md:text-xs text-gray-500 block">Speed</span>
                      <span className="font-mono font-bold text-xl md:text-2xl dark:text-white">{gps.speed} <span className="text-xs md:text-sm font-normal text-gray-400">km/h</span></span>
                    </div>
                    <Activity className="w-6 h-6 md:w-8 md:h-8 text-primary opacity-50" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Quick Actions</h3>

                {isSimulationRunning && (
                  <button
                    onClick={onStopSimulation}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <StopCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium block">Dừng mô phỏng</span>
                      <span className="text-xs opacity-80">
                        {simState.type === 'static' && 'Đang mô phỏng đứng yên'}
                        {simState.type === 'intrusion' && 'Đang mô phỏng xâm nhập'}
                        {simState.type === 'route' && 'Đang mô phỏng di chuyển'}
                      </span>
                    </div>
                  </button>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => onStartSimulation('route')}
                    disabled={!routes.some(r => r.confirmed && r.active) || isSimulationRunning}
                    className="w-full flex items-center gap-3 p-2 md:p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Navigation className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs md:text-sm font-medium dark:text-white block truncate">Simulate Route</span>
                      {!routes.some(r => r.confirmed && r.active) && (
                        <span className="text-[10px] md:text-xs text-gray-400 truncate block">Cần xác nhận tuyến đường trước</span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={handleSimulateIntrusion}
                    disabled={isSimulationRunning}
                    className="w-full flex items-center gap-3 p-2 md:p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-red-500 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </div>
                    <span className="text-xs md:text-sm font-medium dark:text-white truncate">Simulate Intrusion</span>
                  </button>
                  <button
                    onClick={() => onStartSimulation('static')}
                    disabled={isSimulationRunning}
                    className="w-full flex items-center gap-3 p-2 md:p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-amber-500 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <Crosshair className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </div>
                    <span className="text-xs md:text-sm font-medium dark:text-white truncate">Simulate Stay Long</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ZONES TAB */}
          {activeTab === 'zones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Safe Zones</h3>
                <button
                  onClick={handleAddNewZone}
                  className="text-xs bg-primary hover:bg-indigo-600 text-white px-2 md:px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Zone
                </button>
              </div>

              <div className="space-y-3">
                {zones.length === 0 ? (
                  <div className="text-center py-6 md:py-8 text-gray-400 text-xs md:text-sm bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    Chưa có vùng an toàn nào
                  </div>
                ) : (
                  zones.map(zone => (
                    <div key={zone.id} className="p-2 md:p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3 h-3 md:w-4 md:h-4 rounded-full border-2 flex-shrink-0"
                            style={{ backgroundColor: zone.color, borderColor: zone.color }}
                          />
                          <span className="font-semibold text-xs md:text-sm dark:text-white truncate">{zone.name}</span>
                        </div>
                        <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEditZone(zone)}
                            className="p-1 md:p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          </button>
                          <button
                            onClick={() => onToggleZone(zone.id)}
                            className={`p-1 md:p-1.5 rounded-lg ${zone.active ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100'}`}
                          >
                            {zone.active ? <Wifi className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <WifiOff className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                          </button>
                          <button
                            onClick={() => onRemoveZone(zone.id)}
                            className="p-1 md:p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                        <span>R: {zone.radius >= 1000 ? `${(zone.radius / 1000).toFixed(1)}km` : `${zone.radius}m`}</span>
                        <span className="font-mono truncate">{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ROUTE TAB */}
          {activeTab === 'route' && (
            <div className="space-y-4">
              {/* Header with Create Button */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Route Planning</h3>
                <button
                  onClick={onCreateRoute}
                  className="text-xs bg-primary hover:bg-primary/90 text-white px-2 md:px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Tuyến mới
                </button>
              </div>

              {/* Editing Route Info */}
              {editingRouteId && (() => {
                const editingRoute = routes.find(r => r.id === editingRouteId);
                return editingRoute && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 md:p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                    <div className="flex items-start gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300 flex-shrink-0">
                        <Navigation className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs md:text-sm font-bold text-amber-900 dark:text-amber-100">
                          Đang chỉnh sửa: {editingRoute.name}
                        </h4>
                        <p className="text-[10px] md:text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Click lên bản đồ để thêm điểm. {editingRoute.points.length} điểm.
                        </p>
                        <div className="flex gap-2 mt-2">
                          {editingRoute.points.length >= 2 && (
                            <button
                              onClick={() => onConfirmRoute(editingRouteId)}
                              className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Xác nhận
                            </button>
                          )}
                          <button
                            onClick={() => onClearRoutePoints(editingRouteId)}
                            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa điểm
                          </button>
                          <button
                            onClick={() => onSelectRoute(null)}
                            className="text-xs text-gray-500 hover:text-gray-600 flex items-center gap-1 ml-auto"
                          >
                            <X className="w-3 h-3" /> Hủy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Routes List */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {routes.length} tuyến đường
                </h4>
                {routes.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Chưa có tuyến đường nào</p>
                    <p className="text-[10px]">Nhấn "Tuyến mới" để tạo</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {routes.map(route => (
                      <div
                        key={route.id}
                        className={`p-3 rounded-lg border transition-all ${editingRouteId === route.id
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: route.color }}
                          />
                          <span className="text-xs md:text-sm font-medium dark:text-white flex-1 truncate">
                            {route.name}
                          </span>
                          {route.confirmed && (
                            <Check className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-[10px] text-gray-400">
                            {route.points.length} điểm
                          </span>
                          <span className="text-[10px] text-gray-400 mx-1">•</span>
                          <span className={`text-[10px] ${route.confirmed ? 'text-green-500' : 'text-amber-500'}`}>
                            {route.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <button
                            onClick={() => onSelectRoute(route.id)}
                            className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary"
                            title="Chỉnh sửa"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onToggleRoute(route.id)}
                            className={`p-1 rounded ${route.active ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100'}`}
                            title={route.active ? 'Tắt giám sát' : 'Bật giám sát'}
                          >
                            {route.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => onDeleteRoute(route.id)}
                            className="p-1 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 ml-auto"
                            title="Xóa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-4 md:space-y-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">ESP32 Connection</h3>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400">IP Address</label>
                  <p className="text-[10px] text-gray-400">Gợi ý: {suggestedSubnet}xxx</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.espIp}
                      onChange={(e) => onSettingsChange({ ...settings, espIp: e.target.value })}
                      disabled={isConnected}
                      placeholder="192.168.1.100"
                      className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    />
                    {isConnected ? (
                      <button
                        onClick={onDisconnect}
                        className="px-3 md:px-4 rounded-lg flex items-center justify-center gap-1 md:gap-2 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={onConnect}
                        className="px-3 md:px-4 rounded-lg flex items-center justify-center gap-1 md:gap-2 bg-primary text-white hover:bg-indigo-600 transition-colors"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Email Notifications</h3>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Recipient Email</label>
                  <input
                    type="email"
                    value={settings.recipientEmail}
                    onChange={(e) => onSettingsChange({ ...settings, recipientEmail: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Parameters</h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Route Buffer Radius</span>
                    <span className="font-medium dark:text-white">{settings.bufferRadius}m</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={settings.bufferRadius}
                    onChange={(e) => onSettingsChange({ ...settings, bufferRadius: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <div className="flex items-center justify-between p-2 md:p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-gray-500" />
                    <span className="text-xs md:text-sm font-medium dark:text-gray-200">Auto Center Map</span>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, autoCenter: !settings.autoCenter })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.autoCenter ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.autoCenter ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 md:p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    {settings.darkMode ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-orange-400" />}
                    <span className="text-xs md:text-sm font-medium dark:text-gray-200">Dark Mode</span>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, darkMode: !settings.darkMode })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.darkMode ? 'bg-secondary' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.darkMode ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 text-center flex-shrink-0">
          <p className="text-[10px] text-gray-400">© 2026 GPS Guardian System</p>
        </div>
      </aside>

      {/* Zone Editor Modal via Portal */}
      <ModalPortal isOpen={showZoneEditor}>
        <ZoneEditor
          zone={editingZone ?? undefined}
          isNew={!editingZone}
          onSave={handleSaveZone}
          onCancel={handleCloseZoneEditor}
        />
      </ModalPortal>

      {/* Direction Picker Modal via Portal */}
      <ModalPortal isOpen={showDirectionPicker}>
        <DirectionPicker
          onSelect={handleDirectionSelect}
          onCancel={handleCloseDirectionPicker}
        />
      </ModalPortal>
    </>
  );
};

export default Sidebar;
