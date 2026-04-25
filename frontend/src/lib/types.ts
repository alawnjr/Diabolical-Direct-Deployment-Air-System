export interface RadarEntity {
  id: string;
  revealed: boolean;
  destroyed: boolean;
  value: number;
  x?: number;
  y?: number;
}

export interface MissileLauncherEntity {
  id: string;
  revealed: boolean;
  fired: boolean;
  value: number;
  x?: number;
  y?: number;
}

export interface GasTargetEntity {
  id: string;
  revealed: boolean;
  destroyed: boolean;
  value: number;
  x?: number;
  y?: number;
}

export interface LucasDroneEntity {
  id: string;
  type: 'bait' | 'radar_receiver';
  x: number;
  y: number;
  alive: boolean;
  miles_flown: number;
}

export interface SimEntities {
  radars: RadarEntity[];
  missile_launchers: MissileLauncherEntity[];
  gas_targets: GasTargetEntity[];
  lucas_drones: LucasDroneEntity[];
}

export interface RadarPingEvent {
  tick: number;
  type: 'radar_ping';
  radar_id: string;
  x: number;
  y: number;
}

export interface MissileFiredEvent {
  tick: number;
  type: 'missile_fired';
  launcher_id: string;
  target_drone_id: string;
  launcher_x: number;
  launcher_y: number;
}

export interface RadarDestroyedEvent {
  tick: number;
  type: 'radar_destroyed';
  radar_id: string;
  drone_id: string;
  score_gained: number;
  x: number;
  y: number;
}

export interface GasTargetDestroyedEvent {
  tick: number;
  type: 'gas_target_destroyed';
  target_id: string;
  drone_id: string;
  score_gained: number;
  x: number;
  y: number;
}

export type SimEvent =
  | RadarPingEvent
  | MissileFiredEvent
  | RadarDestroyedEvent
  | GasTargetDestroyedEvent;

export interface GameState {
  tick: number;
  score: number;
  complete: boolean;
  drones_alive: number;
  drones_total: number;
  entities: SimEntities;
  events: SimEvent[];
}

export type GamePhase = 'PLANNING' | 'READY' | 'EXECUTION' | 'COMPLETE';

export interface PingEffect {
  id: string;
  x: number;
  y: number;
}
