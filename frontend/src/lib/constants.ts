export const MAP_NM = 200;
export const FEBA_X_NM = 80;
export const SVG_SIZE = 600;
export const NM_TO_PX = SVG_SIZE / MAP_NM; // 3 px per NM

export const RADAR_SIGHT_NM = 100;
export const MISSILE_FIRE_RANGE_NM = 25;
export const DESTROY_THRESHOLD_NM = 3;

export const COLORS = {
  bg: '#0a0e14',
  panel: '#0d1420',
  border: '#1a2332',
  borderBright: '#2a3a4e',
  muted: '#556677',
  body: '#c5cdd8',
  accent: '#ffab00',
  success: '#76ff03',
  threat: '#ff1744',
  usDrone: '#00e5ff',
  lucas: '#76ff03',
  shahed: '#ffd600',
  samSite: '#ff1744',
  ewr: '#ffab00',
  gasTarget: '#ff9800',
  jammer: '#e040fb',
  brandRed: '#ff1744',
  brandDarkRed: '#d50000',
} as const;

export const PHASE_LABELS: Record<string, string> = {
  PLANNING: 'MISSION PLANNING',
  READY: 'FORCES READY',
  EXECUTION: 'EXECUTING',
  COMPLETE: 'MISSION COMPLETE',
};

export const PHASE_COLORS: Record<string, string> = {
  PLANNING: '#556677',
  READY: '#ffab00',
  EXECUTION: '#76ff03',
  COMPLETE: '#00e5ff',
};
