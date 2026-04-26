'use client';

import type { GameState, PingEffect } from '@/lib/types';
import { RADAR_SIGHT_NM, MISSILE_FIRE_RANGE_NM, FEBA_X_NM } from '@/lib/constants';

const S = 600; // SVG viewport size in px
const NM = S / 200; // px per NM = 3

const tx = (nmX: number) => nmX * NM;
const ty = (nmY: number) => S - nmY * NM; // Y-axis flipped: 0 = bottom

interface TacticalMapProps {
  gameState: GameState | null;
  activePings: PingEffect[];
  showThreatRings: boolean;
  showDetected: boolean;
  onToggleThreatRings: () => void;
}

function GridLines() {
  const lines = [];
  for (let i = 0; i <= 20; i++) {
    const v = i * 10;
    const px = v * NM;
    const isMajor = v % 50 === 0;
    lines.push(
      <line
        key={`v${i}`}
        x1={px} y1={0} x2={px} y2={S}
        stroke={isMajor ? '#2a3a4e' : '#1a2332'}
        strokeWidth={isMajor ? 0.8 : 0.4}
      />,
      <line
        key={`h${i}`}
        x1={0} y1={px} x2={S} y2={px}
        stroke={isMajor ? '#2a3a4e' : '#1a2332'}
        strokeWidth={isMajor ? 0.8 : 0.4}
      />
    );
  }
  return <g>{lines}</g>;
}

function GridLabels() {
  const labels = [0, 50, 100, 150, 200];
  return (
    <g>
      {labels.map(v => (
        <g key={v}>
          {/* X axis labels at bottom */}
          <text
            x={tx(v)}
            y={S - 4}
            fill="#2a3a4e"
            fontSize={7}
            textAnchor="middle"
            fontFamily="monospace"
          >
            {v}
          </text>
          {/* Y axis labels at left */}
          {v > 0 && (
            <text
              x={4}
              y={ty(v) + 2.5}
              fill="#2a3a4e"
              fontSize={7}
              textAnchor="start"
              fontFamily="monospace"
            >
              {v}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function DroneIcon({
  type,
  cx,
  cy,
  alive,
}: {
  type: 'bait' | 'radar_receiver';
  cx: number;
  cy: number;
  alive: boolean;
}) {
  if (!alive) {
    return (
      <g>
        <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke="#556677" strokeWidth={1.5} />
        <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} stroke="#556677" strokeWidth={1.5} />
      </g>
    );
  }
  if (type === 'bait') {
    // Diamond ◆ in yellow
    return (
      <polygon
        points={`${cx},${cy - 5} ${cx + 5},${cy} ${cx},${cy + 5} ${cx - 5},${cy}`}
        fill="#ffd600"
        opacity={0.9}
      />
    );
  }
  // LUCAS receiver — circle with center dot in green
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="none" stroke="#76ff03" strokeWidth={1.5} opacity={0.9} />
      <circle cx={cx} cy={cy} r={1.5} fill="#76ff03" opacity={0.9} />
    </g>
  );
}

function RadarIcon({
  cx,
  cy,
  destroyed,
}: {
  cx: number;
  cy: number;
  destroyed: boolean;
}) {
  if (destroyed) {
    return (
      <g>
        <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} stroke="#ff1744" strokeWidth={2} opacity={0.8} />
        <line x1={cx + 6} y1={cy - 6} x2={cx - 6} y2={cy + 6} stroke="#ff1744" strokeWidth={2} opacity={0.8} />
        {/* Ghost outline */}
        <polygon
          points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
          fill="none"
          stroke="#ffab00"
          strokeWidth={0.5}
          opacity={0.3}
        />
      </g>
    );
  }
  return (
    <g>
      <polygon
        points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
        fill="#ffab00"
        opacity={0.9}
      />
      {/* Antenna */}
      <line x1={cx} y1={cy - 8} x2={cx} y2={cy - 14} stroke="#ffab00" strokeWidth={1.5} opacity={0.7} />
      <line x1={cx - 4} y1={cy - 11} x2={cx + 4} y2={cy - 11} stroke="#ffab00" strokeWidth={1} opacity={0.7} />
    </g>
  );
}

function LauncherIcon({
  cx,
  cy,
  missilesRemaining,
}: {
  cx: number;
  cy: number;
  missilesRemaining: number;
}) {
  if (missilesRemaining === 0) {
    return (
      <g>
        <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} stroke="#ff1744" strokeWidth={2} opacity={0.6} />
        <line x1={cx + 6} y1={cy - 6} x2={cx - 6} y2={cy + 6} stroke="#ff1744" strokeWidth={2} opacity={0.6} />
        <polygon
          points={`${cx},${cy - 9} ${cx + 8},${cy + 5} ${cx - 8},${cy + 5}`}
          fill="none"
          stroke="#ff1744"
          strokeWidth={0.5}
          opacity={0.25}
        />
      </g>
    );
  }
  return (
    <polygon
      points={`${cx},${cy - 9} ${cx + 8},${cy + 5} ${cx - 8},${cy + 5}`}
      fill="#ff1744"
      opacity={0.9}
    />
  );
}

function GasIcon({ cx, cy, destroyed }: { cx: number; cy: number; destroyed: boolean }) {
  if (destroyed) {
    return (
      <g>
        <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} stroke="#ff9800" strokeWidth={2} opacity={0.8} />
        <line x1={cx + 6} y1={cy - 6} x2={cx - 6} y2={cy + 6} stroke="#ff9800" strokeWidth={2} opacity={0.8} />
        <rect x={cx - 7} y={cy - 7} width={14} height={14} fill="none" stroke="#ff9800" strokeWidth={0.5} opacity={0.25} />
      </g>
    );
  }
  return <rect x={cx - 7} y={cy - 7} width={14} height={14} fill="#ff9800" opacity={0.9} />;
}

export default function TacticalMap({
  gameState,
  activePings,
  showThreatRings,
  showDetected,
  onToggleThreatRings,
}: TacticalMapProps) {
  const entities = gameState?.entities;

  const febaX = tx(FEBA_X_NM);
  const radarRingR = (gameState?.radar_sight ?? RADAR_SIGHT_NM) * NM;
  const samRingR = (gameState?.missile_fire_range ?? MISSILE_FIRE_RANGE_NM) * NM;

  const radars = entities?.radars ?? [];
  const launchers = entities?.missile_launchers ?? [];
  const gasTargets = entities?.gas_targets ?? [];
  const drones = entities?.lucas_drones ?? [];

  const visibleRadars = showDetected
    ? radars.filter(r => r.revealed)
    : radars;

  // Launchers always have coordinates — show all of them
  const visibleLaunchers = launchers;

  const visibleGas = showDetected
    ? gasTargets.filter(t => t.revealed)
    : gasTargets;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0e14',
        padding: 12,
        position: 'relative',
        minWidth: 0,
      }}
    >
      <svg
        viewBox={`0 0 ${S} ${S}`}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'block',
        }}
      >
        <defs>
          {/* Enemy territory radial gradient */}
          <radialGradient id="enemy-grad" cx="100%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#ff1744" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#ff1744" stopOpacity="0" />
          </radialGradient>
          {/* Friendly territory subtle */}
          <radialGradient id="friendly-grad" cx="0%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </radialGradient>
          {/* Scan line filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect x={0} y={0} width={S} height={S} fill="#0a0e14" />

        {/* Territory overlays */}
        <rect x={0} y={0} width={S} height={S} fill="url(#friendly-grad)" />
        <rect x={febaX} y={0} width={S - febaX} height={S} fill="url(#enemy-grad)" />

        {/* Grid */}
        <GridLines />
        <GridLabels />

        {/* FEBA line */}
        <line
          x1={febaX} y1={0} x2={febaX} y2={S}
          stroke="#ffab00"
          strokeWidth={1.5}
          strokeDasharray="8,4"
          opacity={0.7}
        />
        <text x={febaX + 4} y={16} fill="#ffab00" fontSize={7} fontFamily="monospace" opacity={0.8}>
          FEBA
        </text>
        <text x={febaX + 4} y={24} fill="#ffab00" fontSize={6} fontFamily="monospace" opacity={0.5}>
          {FEBA_X_NM} NM
        </text>

        {/* Scale bar — 50 NM at bottom-left */}
        <line x1={20} y1={S - 18} x2={20 + 50 * NM} y2={S - 18} stroke="#2a3a4e" strokeWidth={1.5} />
        <line x1={20} y1={S - 14} x2={20} y2={S - 22} stroke="#2a3a4e" strokeWidth={1} />
        <line x1={20 + 50 * NM} y1={S - 14} x2={20 + 50 * NM} y2={S - 22} stroke="#2a3a4e" strokeWidth={1} />
        <text x={20 + 25 * NM} y={S - 22} fill="#2a3a4e" fontSize={6} textAnchor="middle" fontFamily="monospace">
          50 NM
        </text>

        {/* Axis labels */}
        <text x={S / 2} y={S - 4} fill="#2a3a4e" fontSize={6} textAnchor="middle" fontFamily="monospace">
          ← W · EAST → (NM)
        </text>

        {/* ── Radar detection rings ── */}
        {showThreatRings && visibleRadars.filter(r => !r.destroyed).map(r => (
          <circle
            key={`ring-r-${r.id}`}
            cx={tx(r.x!)}
            cy={ty(r.y!)}
            r={radarRingR}
            fill="#ffab00"
            fillOpacity={0.04}
            stroke="#ffab00"
            strokeWidth={0.8}
            strokeDasharray="6,4"
            opacity={0.45}
            style={{ animation: 'threat-pulse 4s ease-in-out infinite' }}
          />
        ))}

        {/* ── SAM engagement rings (centered on actual launcher position) ── */}
        {showThreatRings && visibleLaunchers.filter(ml => ml.missiles_remaining > 0).map(ml => (
          <circle
            key={`ring-ml-${ml.id}`}
            cx={tx(ml.x)}
            cy={ty(ml.y)}
            r={samRingR}
            fill="#ff1744"
            fillOpacity={0.05}
            stroke="#ff1744"
            strokeWidth={0.6}
            strokeDasharray="3,4"
            opacity={0.4}
            style={{ animation: 'threat-pulse 3s ease-in-out infinite' }}
          />
        ))}

        {/* ── Radar ping animations (SVG animate, unique key triggers fresh anim) ── */}
        {activePings.map(ping => (
          <g key={ping.id}>
            <circle cx={tx(ping.x)} cy={ty(ping.y)} r={5} fill="none" stroke="#ffab00" strokeWidth={2}>
              <animate attributeName="r" from="5" to={radarRingR * 0.6} dur="1.5s" fill="freeze" />
              <animate attributeName="opacity" from="0.9" to="0" dur="1.5s" fill="freeze" />
              <animate attributeName="stroke-width" from="2" to="0.5" dur="1.5s" fill="freeze" />
            </circle>
            <circle cx={tx(ping.x)} cy={ty(ping.y)} r={5} fill="none" stroke="#ffab00" strokeWidth={1.5}>
              <animate attributeName="r" from="5" to={radarRingR * 0.35} dur="1s" begin="0.3s" fill="freeze" />
              <animate attributeName="opacity" from="0.7" to="0" dur="1s" begin="0.3s" fill="freeze" />
            </circle>
          </g>
        ))}

        {/* ── Gas / supply targets ── */}
        {visibleGas.map(t => (
          <g key={t.id} filter="url(#glow)">
            <GasIcon cx={tx(t.x!)} cy={ty(t.y!)} destroyed={t.destroyed} />
            {!t.destroyed && (
              <text x={tx(t.x!) + 10} y={ty(t.y!) + 3} fill="#ff9800" fontSize={6} fontFamily="monospace" opacity={0.7}>
                {t.id.toUpperCase()}
              </text>
            )}
          </g>
        ))}

        {/* ── SAM Launchers ── */}
        {visibleLaunchers.map(ml => (
          <g key={ml.id} filter="url(#glow)">
            <LauncherIcon cx={tx(ml.x)} cy={ty(ml.y)} missilesRemaining={ml.missiles_remaining} />
            <text
              x={tx(ml.x) + 12}
              y={ty(ml.y) + 3}
              fill={ml.missiles_remaining === 0 ? '#556677' : '#ff1744'}
              fontSize={6}
              fontFamily="monospace"
              opacity={0.8}
            >
              {ml.id.toUpperCase()} [{ml.missiles_remaining}]
            </text>
          </g>
        ))}

        {/* ── Radars ── */}
        {visibleRadars.map(r => (
          <g key={r.id} filter="url(#glow)">
            <RadarIcon cx={tx(r.x!)} cy={ty(r.y!)} destroyed={r.destroyed} />
            <text
              x={tx(r.x!) + 12}
              y={ty(r.y!) + 3}
              fill={r.destroyed ? '#556677' : '#ffab00'}
              fontSize={6}
              fontFamily="monospace"
              opacity={0.8}
            >
              {r.id.toUpperCase()}{r.destroyed ? ' ✗' : ''}
            </text>
          </g>
        ))}

        {/* ── LUCAS drones (alive only — dead drones are removed from the map) ── */}
        {drones.filter(d => d.alive).map(d => (
          <g key={d.id}>
            <DroneIcon type={d.type} cx={tx(d.x)} cy={ty(d.y)} alive={d.alive} />
          </g>
        ))}

        {/* ── Spawn point marker ── */}
        {entities && (
          <g>
            <circle cx={tx(0)} cy={ty(0)} r={8} fill="none" stroke="#00e5ff" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4} />
            <text x={tx(0) + 10} y={ty(0) - 2} fill="#00e5ff" fontSize={6} fontFamily="monospace" opacity={0.5}>
              SPAWN
            </text>
          </g>
        )}

        {/* ── Map labels ── */}
        <text x={febaX / 2} y={22} fill="#00e5ff" fontSize={7} textAnchor="middle" fontFamily="monospace" opacity={0.35}>
          FRIENDLY TERRITORY
        </text>
        <text x={febaX + (S - febaX) / 2} y={22} fill="#ff1744" fontSize={7} textAnchor="middle" fontFamily="monospace" opacity={0.35}>
          CONTESTED AIRSPACE
        </text>

        {/* ── Status overlay (planning) ── */}
        {!gameState && (
          <g>
            <text x={S / 2} y={S / 2 - 12} fill="#1a2332" fontSize={18} textAnchor="middle" fontFamily="monospace" fontWeight={700}>
              AWAITING INITIALIZATION
            </text>
            <text x={S / 2} y={S / 2 + 10} fill="#1a2332" fontSize={9} textAnchor="middle" fontFamily="monospace">
              Configure forces and click INITIALIZE MISSION
            </text>
          </g>
        )}
      </svg>

      {/* Legend overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: 'rgba(10,14,20,0.85)',
          border: '1px solid #1a2332',
          padding: '0.5rem 0.6rem',
          fontSize: '0.55rem',
          lineHeight: 1.8,
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* Range rings toggle */}
        <button
          onClick={onToggleThreatRings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: `1px solid ${showThreatRings ? '#ffab00' : '#1a2332'}`,
            color: showThreatRings ? '#ffab00' : '#556677',
            fontSize: '0.55rem',
            letterSpacing: '0.08em',
            padding: '0.2rem 0.4rem',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '0.4rem',
          }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            border: `1.5px solid ${showThreatRings ? '#ffab00' : '#556677'}`,
            flexShrink: 0,
          }} />
          RANGE RINGS {showThreatRings ? 'ON' : 'OFF'}
        </button>

        <div style={{ color: '#556677', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>LEGEND</div>
        {[
          { color: '#ffd600', shape: '◆', label: 'Bait LUCAS Drone' },
          { color: '#76ff03', shape: '○', label: 'LUCAS Strike Drone' },
          { color: '#ffab00', shape: '◆', label: 'EWR Radar' },
          { color: '#ff1744', shape: '▲', label: 'SAM Launcher' },
          { color: '#ff9800', shape: '■', label: 'Fuel Target' },
        ].map(({ color, shape, label }) => (
          <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color, width: 10, textAlign: 'center' }}>{shape}</span>
            <span style={{ color: '#c5cdd8' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
