import { RoutePoint } from '../types';

const R = 6371e3; // Earth radius in meters

// Calculate distance between two points in meters
export const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Check if point is in circle
export const isPointInCircle = (pLat: number, pLng: number, cLat: number, cLng: number, radius: number): boolean => {
  return getDistance(pLat, pLng, cLat, cLng) <= radius;
};

// Simple check if point is near a polyline (Route buffer)
// Returns true if point is within `buffer` meters of any segment
export const isPointNearRoute = (
  pLat: number, 
  pLng: number, 
  route: RoutePoint[], 
  buffer: number
): boolean => {
  if (route.length < 2) return false;

  for (let i = 0; i < route.length - 1; i++) {
    const start = route[i];
    const end = route[i+1];
    const dist = distanceToSegment(pLat, pLng, start.lat, start.lng, end.lat, end.lng);
    if (dist <= buffer) return true;
  }
  return false;
};

// Distance from point to line segment
function distanceToSegment(pLat: number, pLng: number, x1: number, y1: number, x2: number, y2: number): number {
  // Convert to Cartesian approximation for small distances (quick & dirty) or use proper spherical trigonometry.
  // For GPS scale (meters), standard Euclidean on lat/lon converted to meters is roughly okay for small segments.
  // A better approach is using cross-track distance formula, but let's stick to a robust enough approximation.
  
  // Convert lat/lng to roughly meters from 0,0 (Mercator-ish)
  const x = pLng * (R * Math.cos(pLat * Math.PI / 180) * Math.PI / 180);
  const y = pLat * (R * Math.PI / 180);
  
  const ax = y1 * (R * Math.cos(x1 * Math.PI / 180) * Math.PI / 180);
  const ay = x1 * (R * Math.PI / 180);
  
  const bx = y2 * (R * Math.cos(x2 * Math.PI / 180) * Math.PI / 180);
  const by = x2 * (R * Math.PI / 180);
  
  // Vector math
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return getDistance(pLat, pLng, x1, y1);
  
  // Project point onto line, clamp to segment
  let t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = ax + t * (bx - ax);
  const projY = ay + t * (by - ay);
  
  // Distance from point to projection
  const dx = x - projX;
  const dy = y - projY;
  
  return Math.sqrt(dx * dx + dy * dy); // Approx meters
}

export const generateBufferPolygon = (route: RoutePoint[], radius: number): [number, number][] => {
  // Mock implementation for visualizer - creates a simple simplified buffer visual
  // Real buffer generation requires robust polygon union logic (e.g. turf.js)
  // We will return the line itself for Leaflet to draw with a thick stroke opacity
  return route.map(p => [p.lat, p.lng]);
};