import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Sidebar from './components/Sidebar';
import Map from './components/Map';
import ZoneEditor from './components/ZoneEditor';
import DirectionPicker from './components/DirectionPicker';
import { ToastContainer } from './components/ui/Toast';
import { GPSData, SafeZone, RoutePoint, RouteData, Settings, SimulationState, LogEntry, ZONE_COLORS, ROUTE_COLORS } from './types';
import { DEFAULT_SETTINGS, INITIAL_POSITION, ALERT_DELAY_MS, ESP32_TIMEOUT } from './constants';
import { isPointInCircle, isPointNearRoute } from './utils/geo';
import { sendAlertEmailWithLocation } from './utils/emailService';
import { useAuth } from './contexts/AuthContext';

const API_BASE = 'http://localhost:3002/api';

// Portal component for modals
const ModalPortal: React.FC<{ children: React.ReactNode; isOpen: boolean }> = ({ children, isOpen }) => {
  if (!isOpen) return null;
  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
};



const App: React.FC = () => {
  const { logout, user, token } = useAuth();

  // --- State ---
  // --- State ---
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [gps, setGps] = useState<GPSData>({ ...INITIAL_POSITION, speed: 0, valid: true, timestamp: Date.now() });

  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [simState, setSimState] = useState<SimulationState>({ isActive: false, type: null, progress: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Modal States (Lifted from Sidebar)
  const [showZoneEditor, setShowZoneEditor] = useState(false);
  const [editingZone, setEditingZone] = useState<SafeZone | null>(null);
  const [showDirectionPicker, setShowDirectionPicker] = useState(false);
  const [newZonePosition, setNewZonePosition] = useState<{ lat: number; lng: number } | null>(null);

  // Sidebar state for search bar positioning
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Refs for cleanup and avoiding stale closures
  const abortControllerRef = useRef<AbortController | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);
  const trackingIntervalRef = useRef<number | null>(null);
  const alertTriggeredRef = useRef<boolean>(false);
  const hardwareAlarmLockRef = useRef<boolean>(false);

  // Timer refs for stay long and route deviation
  const stayLongTimerRef = useRef<number | null>(null);
  const routeDeviationTimerRef = useRef<number | null>(null);
  const stayLongAlertSentRef = useRef<boolean>(false);
  const routeDeviationAlertSentRef = useRef<boolean>(false);
  const initialPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // --- API Helper ---
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers as Record<string, string> },
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }, [token]);

  // --- Load data from API ---
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load settings
        const settingsData = await apiRequest('/settings');
        setSettings({
          espIp: settingsData.espIp || DEFAULT_SETTINGS.espIp,
          emailServiceId: DEFAULT_SETTINGS.emailServiceId,
          emailTemplateId: DEFAULT_SETTINGS.emailTemplateId,
          emailPublicKey: DEFAULT_SETTINGS.emailPublicKey,
          recipientEmail: settingsData.recipientEmail || DEFAULT_SETTINGS.recipientEmail,
          darkMode: settingsData.darkMode ?? DEFAULT_SETTINGS.darkMode,
          autoCenter: settingsData.autoCenter ?? DEFAULT_SETTINGS.autoCenter,
          bufferRadius: settingsData.bufferRadius ?? DEFAULT_SETTINGS.bufferRadius,
        });

        // Load zones
        const zonesData = await apiRequest('/zones');
        setZones(zonesData || []);

        // Load routes
        const routesData = await apiRequest('/routes');
        if (Array.isArray(routesData)) {
          setRoutes(routesData);
        } else if (routesData.points) {
          // Legacy single route format - convert to multi-route
          setRoutes([{
            id: 'legacy-1',
            name: 'Tuyến đường 1',
            points: routesData.points || [],
            confirmed: routesData.confirmed || false,
            active: routesData.confirmed || false,
            color: ROUTE_COLORS[0],
            createdAt: Date.now()
          }]);
        }

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token, apiRequest]);

  // Apply dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Real-time polling from ESP32
  useEffect(() => {
    if (isConnected && !simState.isActive) {
      trackingIntervalRef.current = window.setInterval(fetchGPSData, 2000);
      fetchGPSData();
    }

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isConnected, simState.isActive, settings.espIp]);

  // Simulation Logic
  useEffect(() => {
    if (simState.isActive && simState.type) {
      simulationIntervalRef.current = window.setInterval(() => {
        runSimulationStep();
      }, 500);
    } else {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    }
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    };
  }, [simState.isActive, simState.type, simState.direction]);

  // Check safety rules whenever GPS changes
  useEffect(() => {
    checkSafetyRules(gps);
  }, [gps, zones, routes, editingRouteId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (stayLongTimerRef.current) clearTimeout(stayLongTimerRef.current);
      if (routeDeviationTimerRef.current) clearTimeout(routeDeviationTimerRef.current);
    };
  }, []);

  // --- Logic ---

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const newLog = { id: Date.now().toString(), time: new Date().toLocaleTimeString(), message, type };
    setLogs(prev => [newLog, ...prev].slice(0, 5));
  }, []);

  const removeLog = useCallback((id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const fetchGPSData = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), ESP32_TIMEOUT);

      const esp32Url = settings.espIp.startsWith('http')
        ? settings.espIp
        : `http://${settings.espIp}`;

      const response = await fetch(`${esp32Url}/gps`, {
        signal: abortControllerRef.current.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      if (data.lat && data.lat !== 0) {
        setGps(prev => ({
          ...prev,
          lat: data.lat,
          lng: data.lng,
          speed: data.speed || 0,
          valid: data.valid !== false,
          timestamp: Date.now()
        }));

        if (data.alarm === true && !hardwareAlarmLockRef.current) {
          hardwareAlarmLockRef.current = true;
          addLog('🆘 KHẨN CẤP: Nút báo động trên ESP32 đã được kích hoạt!', 'error');
          sendAlertEmailWithLocation('OUT_OF_ZONE', data.lat, data.lng, 'Nút báo động vật lý đã được kích hoạt', settings.recipientEmail);
        } else if (data.alarm === false) {
          hardwareAlarmLockRef.current = false;
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setIsConnected(false);
        addLog('❌ Không thể kết nối tới ESP32', 'error');
      }
    }
  };

  const runSimulationStep = () => {
    setSimState(prevSim => {
      if (!prevSim.isActive || !prevSim.type) return prevSim;

      const newProgress = prevSim.progress + 0.02;

      if (newProgress >= 1 && prevSim.type !== 'route' && prevSim.type !== 'static') {
        addLog(`✅ Simulation completed: ${prevSim.type}`, 'success');
        return { isActive: false, type: null, progress: 0 };
      }

      setGps(prev => {
        let newLat = prev.lat;
        let newLng = prev.lng;
        let newSpeed = prev.speed;

        if (prevSim.type === 'static') {
          if (initialPositionRef.current) {
            newLat = initialPositionRef.current.lat + (Math.random() - 0.5) * 0.00001;
            newLng = initialPositionRef.current.lng + (Math.random() - 0.5) * 0.00001;
          }
          newSpeed = 0;
        } else if (prevSim.type === 'intrusion') {
          const speedKmh = prevSim.simSpeed ?? 35;

          // Nếu tốc độ = 0, giữ nguyên vị trí (đứng yên)
          if (speedKmh === 0) {
            newSpeed = 0;
          } else {
            const angle = prevSim.direction ?? 45;
            const radians = (angle * Math.PI) / 180;

            // Calculate step based on simSpeed (km/h -> degrees per step)
            // Simulation interval is 500ms (0.5 seconds)
            // 1 degree of latitude ≈ 111.32 km
            // Base formula: step = (speed km/h) / (111.32 km/deg) / (3600 s/h) * (0.5 s/step)
            // Multiplied by scale factor for visible movement on map
            const scaleFactor = 100; // Adjustable for map visualization
            const step = (speedKmh / 111.32 / 3600) * 0.05 * scaleFactor;

            newLat += step * Math.cos(radians);
            newLng += step * Math.sin(radians);
            newSpeed = speedKmh;
          }
        } else if (prevSim.type === 'route') {
          // Get first active confirmed route for simulation
          const activeRoute = routes.find(r => r.active && r.confirmed);
          if (activeRoute && activeRoute.points.length > 1) {
            const totalPoints = activeRoute.points.length;
            const loopProgress = newProgress % 1;
            const currentIdx = Math.floor(loopProgress * (totalPoints - 1));
            const nextIdx = Math.min(currentIdx + 1, totalPoints - 1);
            const localProgress = (loopProgress * (totalPoints - 1)) - currentIdx;

            const p1 = activeRoute.points[currentIdx];
            const p2 = activeRoute.points[nextIdx];

            newLat = p1.lat + (p2.lat - p1.lat) * localProgress;
            newLng = p1.lng + (p2.lng - p1.lng) * localProgress;
            newSpeed = Math.round(40 + Math.random() * 15);
          }
        }

        return { ...prev, lat: newLat, lng: newLng, speed: newSpeed, timestamp: Date.now() };
      });

      if ((prevSim.type === 'route' || prevSim.type === 'static') && newProgress >= 1) {
        return { ...prevSim, progress: 0 };
      }

      return { ...prevSim, progress: Math.min(newProgress, 1) };
    });
  };

  const checkSafetyRules = useCallback(async (currentGps: GPSData) => {
    const activeZones = zones.filter(z => z.active);

    let inSafeZone = false;
    activeZones.forEach(zone => {
      if (isPointInCircle(currentGps.lat, currentGps.lng, zone.lat, zone.lng, zone.radius)) {
        inSafeZone = true;
      }
    });

    // Check deviation for all active confirmed routes
    let deviation = false;
    const activeRoutes = routes.filter(r => r.active && r.confirmed && r.points.length > 1);
    if (activeRoutes.length > 0) {
      const nearAnyRoute = activeRoutes.some(route =>
        isPointNearRoute(currentGps.lat, currentGps.lng, route.points, settings.bufferRadius)
      );
      if (!nearAnyRoute) deviation = true;
    }

    const hasZones = activeZones.length > 0;
    const hasRoute = activeRoutes.length > 0;

    if (hasZones && !inSafeZone && !alertTriggeredRef.current) {
      alertTriggeredRef.current = true;
      addLog('🚨 CẢNH BÁO: Thiết bị ra khỏi vùng an toàn!', 'error');
      await sendAlertEmailWithLocation('OUT_OF_ZONE', currentGps.lat, currentGps.lng, undefined, settings.recipientEmail);
    } else if (hasZones && inSafeZone) {
      if (alertTriggeredRef.current) {
        addLog('✅ Thiết bị đã quay lại vùng an toàn', 'success');
      }
      alertTriggeredRef.current = false;
    }

    if (hasZones && !inSafeZone && simState.type === 'static') {
      if (!stayLongTimerRef.current && !stayLongAlertSentRef.current) {
        addLog('⏱️ Bắt đầu đếm thời gian đứng ngoài vùng an toàn...', 'warning');
        stayLongTimerRef.current = window.setTimeout(async () => {
          if (!stayLongAlertSentRef.current) {
            stayLongAlertSentRef.current = true;
            addLog('🚨 CẢNH BÁO: Đã đứng ngoài vùng an toàn quá lâu!', 'error');
            await sendAlertEmailWithLocation('STAY_LONG', currentGps.lat, currentGps.lng, 'Thiết bị đã đứng ngoài vùng an toàn quá 5 giây', settings.recipientEmail);
          }
        }, ALERT_DELAY_MS);
      }
    } else {
      if (stayLongTimerRef.current) {
        clearTimeout(stayLongTimerRef.current);
        stayLongTimerRef.current = null;
      }
      if (inSafeZone) {
        stayLongAlertSentRef.current = false;
      }
    }

    if (hasRoute && deviation) {
      if (!routeDeviationTimerRef.current && !routeDeviationAlertSentRef.current) {
        addLog('⏱️ Bắt đầu đếm thời gian lệch tuyến đường...', 'warning');
        routeDeviationTimerRef.current = window.setTimeout(async () => {
          if (!routeDeviationAlertSentRef.current) {
            routeDeviationAlertSentRef.current = true;
            addLog('🚨 CẢNH BÁO: Đã lệch tuyến đường quá lâu!', 'error');
            await sendAlertEmailWithLocation('OUT_OF_ZONE', currentGps.lat, currentGps.lng, 'Thiết bị đã lệch khỏi tuyến đường quá 5 giây', settings.recipientEmail);
          }
        }, ALERT_DELAY_MS);
      }
    } else {
      if (routeDeviationTimerRef.current) {
        clearTimeout(routeDeviationTimerRef.current);
        routeDeviationTimerRef.current = null;
      }
      if (!deviation) {
        routeDeviationAlertSentRef.current = false;
      }
    }
  }, [zones, routes, settings.bufferRadius, settings.recipientEmail, addLog, simState.type]);

  // --- Handlers ---

  // Handle map click for adding points to editing route
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (editingRouteId) {
      // Add point to editing route
      setRoutes(prev => prev.map(r =>
        r.id === editingRouteId
          ? { ...r, points: [...r.points, { lat, lng }], confirmed: false }
          : r
      ));
      addLog(`📍 Đã thêm điểm tuyến đường: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'info');
    }
  }, [editingRouteId, addLog]);

  const handleMapDoubleClick = useCallback((lat: number, lng: number) => {
    setNewZonePosition({ lat, lng });
    setEditingZone(null);
    setShowZoneEditor(true);
  }, []);

  const handleUpdateRoutePoint = useCallback((routeId: string, index: number, lat: number, lng: number) => {
    setRoutes(prev => prev.map(r =>
      r.id === routeId
        ? {
          ...r,
          points: r.points.map((p, i) => i === index ? { lat, lng } : p),
          confirmed: false // Mark as unconfirmed after edit
        }
        : r
    ));
    addLog(`📍 Đã cập nhật điểm tuyến đường #${index + 1}`, 'info');
  }, [addLog]);

  // Modal Handlers
  const handleOpenZoneEditor = useCallback((zone?: SafeZone) => {
    setNewZonePosition(null);
    setEditingZone(zone || null);
    setShowZoneEditor(true);
  }, []);

  const handleCloseZoneEditor = useCallback(() => {
    setShowZoneEditor(false);
    setEditingZone(null);
    setNewZonePosition(null);
  }, []);

  const handleOpenDirectionPicker = useCallback(() => {
    setShowDirectionPicker(true);
  }, []);

  const handleCloseDirectionPicker = useCallback(() => {
    setShowDirectionPicker(false);
  }, []);


  // Modified handleAddZone to support double click position
  const handleAddZone = useCallback(async (zoneData: Partial<SafeZone>) => {
    const newZone: SafeZone = {
      id: Date.now().toString(),
      name: zoneData.name || `Vùng ${zones.length + 1}`,
      lat: newZonePosition?.lat ?? zoneData.lat ?? gps.lat,
      lng: newZonePosition?.lng ?? zoneData.lng ?? gps.lng,
      radius: zoneData.radius ?? 200,
      color: zoneData.color ?? ZONE_COLORS[zones.length % ZONE_COLORS.length],
      active: true
    };

    setZones(prev => [...prev, newZone]);
    addLog('✅ Đã thêm vùng an toàn mới', 'success');

    // Save to API
    try {
      await apiRequest('/zones', {
        method: 'POST',
        body: JSON.stringify(newZone),
      });
    } catch (error) {
      console.error('Error saving zone:', error);
    }
  }, [gps.lat, gps.lng, zones.length, addLog, apiRequest, newZonePosition]);

  const handleUpdateZone = useCallback(async (id: string, zoneData: Partial<SafeZone>) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...zoneData } : z));
    addLog('✏️ Đã cập nhật vùng an toàn', 'info');

    // Save to API
    try {
      const zone = zones.find(z => z.id === id);
      if (zone) {
        await apiRequest(`/zones/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...zone, ...zoneData }),
        });
      }
    } catch (error) {
      console.error('Error updating zone:', error);
    }
  }, [addLog, apiRequest, zones]);

  const handleSettingsChange = useCallback(async (newSettings: Settings) => {
    setSettings(newSettings);

    // Save to API
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          espIp: newSettings.espIp,
          recipientEmail: newSettings.recipientEmail,
          bufferRadius: newSettings.bufferRadius,
          autoCenter: newSettings.autoCenter,
          darkMode: newSettings.darkMode,
        }),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [apiRequest]);

  const handleConnect = useCallback(async () => {
    setSimState({ isActive: false, type: null, progress: 0 });
    alertTriggeredRef.current = false;

    addLog(`📡 Đang kết nối tới ESP32 tại ${settings.espIp}...`, 'info');

    try {
      const esp32Url = settings.espIp.startsWith('http')
        ? settings.espIp
        : `http://${settings.espIp}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ESP32_TIMEOUT);

      const response = await fetch(`${esp32Url}/gps`, {
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.lat !== undefined) {
          setIsConnected(true);
          addLog('✅ Kết nối ESP32 thành công!', 'success');
        } else {
          throw new Error('Invalid data format');
        }
      } else {
        throw new Error('Network response was not ok');
      }
    } catch (error) {
      addLog('❌ Không thể kết nối tới ESP32. Kiểm tra địa chỉ IP.', 'error');
      setIsConnected(false);
    }
  }, [settings.espIp, addLog]);

  const handleDisconnect = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsConnected(false);
    addLog('🔌 Đã ngắt kết nối ESP32', 'info');
  }, [addLog]);

  const handleStartSimulation = useCallback((type: 'route' | 'intrusion' | 'static', direction?: number, simSpeed?: number) => {
    setIsConnected(false);
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }

    alertTriggeredRef.current = false;
    stayLongAlertSentRef.current = false;
    routeDeviationAlertSentRef.current = false;

    if (stayLongTimerRef.current) {
      clearTimeout(stayLongTimerRef.current);
      stayLongTimerRef.current = null;
    }
    if (routeDeviationTimerRef.current) {
      clearTimeout(routeDeviationTimerRef.current);
      routeDeviationTimerRef.current = null;
    }

    if (type === 'static') {
      initialPositionRef.current = { lat: gps.lat, lng: gps.lng };
    }

    setSimState({ isActive: true, type, progress: 0, direction, simSpeed });

    const typeNames: Record<string, string> = {
      route: 'Đi theo tuyến đường',
      intrusion: `Xâm nhập (hướng ${direction ?? 45}°, tốc độ ${simSpeed ?? 35} km/h)`,
      static: 'Đứng yên ngoài vùng an toàn'
    };
    addLog(`🎮 Bắt đầu mô phỏng: ${typeNames[type]}`, 'info');
  }, [addLog, gps.lat, gps.lng]);

  const handleDirectionSelect = useCallback((direction: number, speed: number) => {
    console.log('📍 handleDirectionSelect called with direction:', direction, 'speed:', speed);
    setShowDirectionPicker(false);

    // Reset connection and intervals
    setIsConnected(false);
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }

    // Reset alert flags
    alertTriggeredRef.current = false;
    stayLongAlertSentRef.current = false;
    routeDeviationAlertSentRef.current = false;

    // Clear timers
    if (stayLongTimerRef.current) {
      clearTimeout(stayLongTimerRef.current);
      stayLongTimerRef.current = null;
    }
    if (routeDeviationTimerRef.current) {
      clearTimeout(routeDeviationTimerRef.current);
      routeDeviationTimerRef.current = null;
    }

    // Set simulation state with speed
    console.log('📍 Setting simState with simSpeed:', speed);
    setSimState({ isActive: true, type: 'intrusion', progress: 0, direction, simSpeed: speed });

    addLog(`🎮 Bắt đầu mô phỏng: Xâm nhập (hướng ${direction}°, tốc độ ${speed} km/h)`, 'info');
  }, [addLog]);

  const handleStopSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (stayLongTimerRef.current) {
      clearTimeout(stayLongTimerRef.current);
      stayLongTimerRef.current = null;
    }
    if (routeDeviationTimerRef.current) {
      clearTimeout(routeDeviationTimerRef.current);
      routeDeviationTimerRef.current = null;
    }
    setSimState({ isActive: false, type: null, progress: 0 });
    addLog('⏹️ Đã dừng mô phỏng', 'info');
  }, [addLog]);

  const handleRemoveZone = useCallback(async (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id));
    addLog('🗑️ Đã xóa vùng an toàn', 'info');

    try {
      await apiRequest(`/zones/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error deleting zone:', error);
    }
  }, [addLog, apiRequest]);

  const handleToggleZone = useCallback(async (id: string) => {
    const zone = zones.find(z => z.id === id);
    if (zone) {
      const newActive = !zone.active;
      setZones(prev => prev.map(z => z.id === id ? { ...z, active: newActive } : z));

      try {
        await apiRequest(`/zones/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...zone, active: newActive }),
        });
      } catch (error) {
        console.error('Error toggling zone:', error);
      }
    }
  }, [zones, apiRequest]);

  // Route management handlers
  const handleCreateNewRoute = useCallback(() => {
    const newRoute: RouteData = {
      id: Date.now().toString(),
      name: `Tuyến đường ${routes.length + 1}`,
      points: [],
      confirmed: false,
      active: true,
      color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length],
      createdAt: Date.now()
    };
    setRoutes(prev => [...prev, newRoute]);
    setEditingRouteId(newRoute.id);
    addLog(`📍 Đã tạo tuyến đường mới: ${newRoute.name}`, 'info');
  }, [routes.length, addLog]);

  const handleDeleteRoute = useCallback(async (routeId: string) => {
    setRoutes(prev => prev.filter(r => r.id !== routeId));
    if (editingRouteId === routeId) {
      setEditingRouteId(null);
    }
    addLog('🗑️ Đã xóa tuyến đường', 'info');

    try {
      await apiRequest(`/routes/${routeId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error deleting route:', error);
    }
  }, [editingRouteId, addLog, apiRequest]);

  const handleSelectRouteForEdit = useCallback((routeId: string | null) => {
    setEditingRouteId(routeId);
    if (routeId) {
      addLog(`✏️ Đang chỉnh sửa tuyến đường`, 'info');
    }
  }, [addLog]);

  const handleToggleRoute = useCallback(async (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      const newActive = !route.active;
      setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, active: newActive } : r));
      addLog(`${newActive ? '✅ Kích hoạt' : '⏸️ Tạm dừng'} giám sát tuyến đường`, 'info');
    }
  }, [routes, addLog]);

  const handleConfirmRoute = useCallback(async (routeId?: string) => {
    const targetId = routeId || editingRouteId;
    if (!targetId) return;

    const route = routes.find(r => r.id === targetId);
    if (route && route.points.length >= 2) {
      setRoutes(prev => prev.map(r =>
        r.id === targetId ? { ...r, confirmed: true, active: true } : r
      ));
      setEditingRouteId(null);
      addLog('✅ Đã xác nhận tuyến đường. Hệ thống sẽ giám sát độ lệch.', 'success');

      try {
        await apiRequest('/routes', {
          method: 'POST',
          body: JSON.stringify(routes.map(r =>
            r.id === targetId ? { ...r, confirmed: true, active: true } : r
          )),
        });
      } catch (error) {
        console.error('Error confirming route:', error);
      }
    } else {
      addLog('⚠️ Cần ít nhất 2 điểm để xác nhận tuyến đường', 'warning');
    }
  }, [routes, editingRouteId, addLog, apiRequest]);

  const handleClearRoutePoints = useCallback((routeId?: string) => {
    const targetId = routeId || editingRouteId;
    if (!targetId) return;

    setRoutes(prev => prev.map(r =>
      r.id === targetId ? { ...r, points: [], confirmed: false } : r
    ));
    addLog('🗑️ Đã xóa các điểm tuyến đường', 'info');
  }, [editingRouteId, addLog]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Compute effective settings - disable autoCenter during simulation
  const effectiveSettings = {
    ...settings,
    autoCenter: simState.isActive ? false : settings.autoCenter
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-100 dark:bg-dark-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 dark:bg-dark-bg">
      <Sidebar
        gps={gps}
        settings={settings}
        zones={zones}
        routes={routes}
        editingRouteId={editingRouteId}
        isConnected={isConnected}
        simState={simState}
        onSettingsChange={handleSettingsChange}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onAddZone={handleAddZone}
        onUpdateZone={handleUpdateZone}
        onRemoveZone={handleRemoveZone}
        onToggleZone={handleToggleZone}
        // Route handlers
        onCreateRoute={handleCreateNewRoute}
        onDeleteRoute={handleDeleteRoute}
        onSelectRoute={handleSelectRouteForEdit}
        onToggleRoute={handleToggleRoute}
        onConfirmRoute={handleConfirmRoute}
        onClearRoutePoints={handleClearRoutePoints}
        onStartSimulation={handleStartSimulation}
        onStopSimulation={handleStopSimulation}
        onLogout={handleLogout}
        // Modal Controllers
        onOpenZoneEditor={handleOpenZoneEditor}
        onEditZone={(zone) => handleOpenZoneEditor(zone)}
        onSimulateIntrusion={handleOpenDirectionPicker}
        onSidebarChange={(width, collapsed) => {
          setSidebarWidth(width);
          setIsSidebarCollapsed(collapsed);
        }}
      />
      <div className="flex-1 relative">
        <Map
          gps={gps}
          zones={zones}
          routes={routes}
          editingRouteId={editingRouteId}
          settings={effectiveSettings}
          onMapClick={handleMapClick}
          onMapDoubleClick={handleMapDoubleClick}
          onUpdateRoutePoint={handleUpdateRoutePoint}
          sidebarLeft={isSidebarCollapsed ? 0 : sidebarWidth}
        />
        <ToastContainer logs={logs} onRemove={removeLog} />

        {/* Simulation Status Overlay */}
        {simState.isActive && (
          <div className="absolute top-4 right-4 bg-white dark:bg-dark-card shadow-lg rounded-xl p-3 md:p-4 z-[2000] border border-gray-200 dark:border-gray-700 max-w-[200px] md:max-w-none">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-semibold dark:text-white truncate">
                  {simState.type === 'route' && '🚶 Đi theo đường'}
                  {simState.type === 'intrusion' && `🚨 Xâm nhập`}
                  {simState.type === 'static' && '📍 Đứng yên'}
                </p>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(simState.progress * 100, 100)}%` }}
                  />
                </div>
              </div>
              <button
                onClick={handleStopSimulation}
                className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200 transition-colors flex-shrink-0"
              >
                Dừng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Zone Editor Modal via Portal */}
      <ModalPortal isOpen={showZoneEditor}>
        <ZoneEditor
          zone={editingZone ?? undefined}
          isNew={!editingZone}
          onSave={handleAddZone}
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
    </div>
  );
};

export default App;
