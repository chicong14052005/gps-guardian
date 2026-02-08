import { SafeZone, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  espIp: '192.168.1.100',
  emailServiceId: 'service_xyowmff',
  emailTemplateId: 'template_intrusion',
  emailPublicKey: '4cvVLEjXS7gDEgoOT',
  recipientEmail: 'congcuong123465@gmail.com',
  darkMode: false,
  autoCenter: true,
  bufferRadius: 100,
};

export const INITIAL_POSITION = {
  lat: 10.9589, // Default: Bien Hoa, Dong Nai
  lng: 106.8554
};

export const MOCK_SAFE_ZONES: SafeZone[] = [
  {
    id: '1',
    name: 'School Zone',
    lat: 10.9589,
    lng: 106.8554,
    radius: 200,
    color: '#10b981',
    active: true
  }
];

export const STORAGE_KEYS = {
  SETTINGS: 'gps_tracker_settings',
  ZONES: 'gps_tracker_zones',
  ROUTE: 'gps_tracker_route',
  ROUTE_CONFIRMED: 'gps_tracker_route_confirmed',
  USER: 'gps_tracker_user'
};

// Timeout cho việc kết nối ESP32 (ms)
export const ESP32_TIMEOUT = 3000;

// Thời gian trigger cảnh báo stay long / route deviation (ms) - 5 giây cho mô phỏng
export const ALERT_DELAY_MS = 5000;