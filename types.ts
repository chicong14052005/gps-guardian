export interface GPSData {
  lat: number;
  lng: number;
  speed: number;
  valid: boolean;
  timestamp: number;
}

export interface SafeZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
  color: string; // hex color
  active: boolean;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface Settings {
  espIp: string;
  emailServiceId: string;
  emailTemplateId: string;
  emailPublicKey: string;
  recipientEmail: string; // Email nhận thông báo
  darkMode: boolean;
  autoCenter: boolean;
  bufferRadius: number; // meters
}

export interface SimulationState {
  isActive: boolean;
  type: 'route' | 'intrusion' | 'static' | null;
  progress: number;
  direction?: number; // Góc di chuyển (0-360 độ)
  simSpeed?: number; // Tốc độ mô phỏng (km/h)
}

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface RouteData {
  id: string;
  name: string;
  points: RoutePoint[];
  confirmed: boolean;
  active: boolean; // Whether this route is being monitored
  color: string;
  createdAt: number;
}

// Route colors for multi-route visualization
export const ROUTE_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // green
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

// Preset radius options
export const RADIUS_PRESETS = [100, 200, 500, 1000, 2000, 3000, 5000, 10000];

// Default zone colors
export const ZONE_COLORS = [
  '#10b981', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];