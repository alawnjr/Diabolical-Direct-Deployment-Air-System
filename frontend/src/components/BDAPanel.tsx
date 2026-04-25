'use client';

import type { GameState } from '@/lib/types';

interface BDAPanelProps {
  gameState: GameState | null;
}

export default function BDAPanel({ gameState }: BDAPanelProps) {
  const radarsTotal = gameState?.entities.radars.length ?? 6;
  const radarsDestroyed = gameState?.entities.radars.filter(r => r.destroyed).length ?? 0;
  const launchersTotal = gameState?.entities.missile_launchers.length ?? 6;
  const launchersRevealed = gameState?.entities.missile_launchers.filter(ml => ml.revealed).length ?? 0;
  const gasTotal = gameState?.entities.gas_targets.length ?? 4;
  const gasDestroyed = gameState?.entities.gas_targets.filter(t => t.destroyed).length ?? 0;
  const targetsTotal = radarsTotal + gasTotal;
  const targetsHit = radarsDestroyed + gasDestroyed;
  const dronesLost = gameState
    ? gameState.drones_total - gameState.drones_alive
    : 0;
  const dronesTotal = gameState?.drones_total ?? 0;

  return (
    <div className="tac-panel" style={{ flexShrink: 0 }}>
      <div className="tac-panel-header">BATTLE DAMAGE ASSESSMENT</div>

      {/* Big number cards */}
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <div className="bda-card">
          <div className="big-num" style={{ color: '#76ff03' }}>
            {targetsHit}<span style={{ fontSize: '1rem', color: '#556677' }}>/{targetsTotal}</span>
          </div>
          <div className="label">Targets Hit</div>
        </div>
        <div className="bda-card">
          <div className="big-num" style={{ color: '#ff1744' }}>
            {dronesLost}<span style={{ fontSize: '1rem', color: '#556677' }}>/{dronesTotal}</span>
          </div>
          <div className="label">US Losses</div>
        </div>
      </div>

      {/* Detail rows */}
      <div style={{ padding: '0 8px 8px' }}>
        <div
          style={{
            border: '1px solid #1a2332',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
          }}
        >
          {[
            {
              label: 'RADARS DESTROYED',
              value: `${radarsDestroyed} / ${radarsTotal}`,
              color: '#76ff03',
            },
            {
              label: 'EMITTERS DETECTED',
              value: `${launchersRevealed} / ${launchersTotal}`,
              color: '#00e5ff',
            },
            {
              label: 'FUEL TARGETS HIT',
              value: `${gasDestroyed} / ${gasTotal}`,
              color: '#ff9800',
            },
            {
              label: 'SCORE',
              value: String(gameState?.score ?? 0),
              color: '#ffab00',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}
            >
              <span style={{ color: '#556677' }}>{label}</span>
              <span style={{ color, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mission doctrine */}
      <div
        style={{
          margin: '0 8px 8px',
          border: '1px solid #1a2332',
          padding: '0.5rem',
        }}
      >
        <div
          style={{
            fontSize: '0.55rem',
            color: '#ffab00',
            letterSpacing: '0.1em',
            marginBottom: '0.4rem',
          }}
        >
          MISSION DOCTRINE
        </div>
        {[
          ['1', 'PLAN', 'Configure Shahed & LUCAS counts'],
          ['2', 'INIT', 'Generate adversary IADS scenario'],
          ['3', 'EXEC', 'Run ticks — Shaheds bait, LUCAS attack'],
          ['4', 'ASSESS', 'Review BDA, replay events, new scenario'],
        ].map(([num, step, desc]) => (
          <div key={step} style={{ display: 'flex', gap: 6, marginBottom: '0.25rem', fontSize: '0.57rem' }}>
            <span
              style={{
                color: '#ff1744',
                fontWeight: 700,
                width: 10,
                flexShrink: 0,
              }}
            >
              {num}.
            </span>
            <span style={{ color: '#00e5ff', fontWeight: 700, width: 36, flexShrink: 0 }}>{step}</span>
            <span style={{ color: '#556677' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
