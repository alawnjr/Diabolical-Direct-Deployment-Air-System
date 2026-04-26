'use client';

import type { GamePhase, GameState } from '@/lib/types';

interface AssetPaletteProps {
  phase: GamePhase;
  numBait: number;
  numReceiver: number;
  numCamera: number;
  radarRange: number;
  samRange: number;
  numRadars: number;
  numLaunchers: number;
  numGas: number;
  onNumBaitChange: (n: number) => void;
  onNumReceiverChange: (n: number) => void;
  onNumCameraChange: (n: number) => void;
  onRadarRangeChange: (n: number) => void;
  onSamRangeChange: (n: number) => void;
  onNumRadarsChange: (n: number) => void;
  onNumLaunchersChange: (n: number) => void;
  onNumGasChange: (n: number) => void;
  onInitialize: () => void;
  onLaunchAll: () => void;
  onExecute: () => void;
  onFullRun: () => void;
  onReset: () => void;
  gameState: GameState | null;
  isExecuting: boolean;
}

function AssetCard({
  color,
  icon,
  label,
  sublabel,
  count,
  onCountChange,
  disabled,
}: {
  color: string;
  icon: string;
  label: string;
  sublabel: string;
  count: number;
  onCountChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid #1a2332`,
        borderLeft: `3px solid ${color}`,
        background: '#0d1420',
        padding: '0.6rem',
        marginBottom: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span>{icon}</span>
            <span>{label}</span>
          </div>
          <div style={{ fontSize: '0.55rem', color: '#556677', marginTop: '0.1rem' }}>{sublabel}</div>
        </div>
        <div style={{
          minWidth: 28, height: 28,
          border: `1px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 700, color,
        }}>
          {count}
        </div>
      </div>

      <input
        type="range"
        min={1}
        max={15}
        value={count}
        disabled={disabled}
        onChange={(e) => onCountChange(Number(e.target.value))}
        style={{ opacity: disabled ? 0.35 : 1 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
        <span style={{ fontSize: '0.5rem', color: '#556677' }}>1</span>
        <span style={{ fontSize: '0.5rem', color: '#556677' }}>15</span>
      </div>
    </div>
  );
}

export default function AssetPalette({
  phase,
  numBait,
  numReceiver,
  numCamera,
  radarRange,
  samRange,
  numRadars,
  numLaunchers,
  numGas,
  onNumBaitChange,
  onNumReceiverChange,
  onNumCameraChange,
  onRadarRangeChange,
  onSamRangeChange,
  onNumRadarsChange,
  onNumLaunchersChange,
  onNumGasChange,
  onInitialize,
  onLaunchAll,
  onExecute,
  onFullRun,
  onReset,
  gameState,
  isExecuting,
}: AssetPaletteProps) {
  const isPlanning = phase === 'PLANNING';
  const isReady = phase === 'READY';
  const isExec = phase === 'EXECUTION';
  const isComplete = phase === 'COMPLETE';
  const totalDrones = numBait + numReceiver + numCamera;

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1a2332',
        background: '#0a0e14',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.6rem 0.75rem',
          borderBottom: '1px solid #1a2332',
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: '#556677',
        }}
      >
        ASSET CONFIGURATION
      </div>

      <div style={{ padding: '0.75rem', flex: 1 }}>

        {/* Force composition */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            FORCE COMPOSITION
          </div>

          <AssetCard
            color="#ffd600"
            icon="◆"
            label="Bait LUCAS Drone"
            sublabel="Fast bait drone (200 mph) — triggers SAM responses"
            count={numBait}
            onCountChange={onNumBaitChange}
            disabled={!isPlanning}
          />

          <AssetCard
            color="#76ff03"
            icon="●"
            label="LUCAS Strike"
            sublabel="Radar receiver — detects & destroys emitters"
            count={numReceiver}
            onCountChange={onNumReceiverChange}
            disabled={!isPlanning}
          />

          <AssetCard
            color="#00e5ff"
            icon="⬠"
            label="Camera Drone"
            sublabel="Scans 30 NM radius — locks & destroys any target (click to toggle)"
            count={numCamera}
            onCountChange={onNumCameraChange}
            disabled={!isPlanning}
          />
        </div>

        {/* Threat parameters */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            THREAT PARAMETERS
          </div>
          {[
            { label: 'Radar Range', color: '#ffab00', value: radarRange, min: 20, max: 200, step: 10, onChange: onRadarRangeChange, unit: 'NM' },
            { label: 'SAM Range',   color: '#ff1744', value: samRange,   min: 5,  max: 100, step: 5,  onChange: onSamRangeChange,   unit: 'NM' },
          ].map(({ label, color, value, min, max, step, onChange, unit }) => (
            <div key={label} style={{ border: `1px solid #1a2332`, borderLeft: `3px solid ${color}`, background: '#0d1420', padding: '0.5rem 0.6rem', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color }}>{label}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color, minWidth: 46, textAlign: 'right' }}>{value} {unit}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={!isPlanning}
                onChange={e => onChange(Number(e.target.value))}
                style={{ opacity: isPlanning ? 1 : 0.35 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '0.5rem', color: '#556677' }}>{min}</span>
                <span style={{ fontSize: '0.5rem', color: '#556677' }}>{max}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Enemy composition */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            ENEMY COMPOSITION
          </div>
          {[
            { label: 'EWR Radars',     color: '#ffab00', value: numRadars,    min: 1, max: 10, step: 1, onChange: onNumRadarsChange,    unit: '' },
            { label: 'SAM Launchers',  color: '#ff1744', value: numLaunchers, min: 0, max: 10, step: 1, onChange: onNumLaunchersChange, unit: '' },
            { label: 'Fuel Targets',   color: '#ff9800', value: numGas,       min: 1, max: 8,  step: 1, onChange: onNumGasChange,       unit: '' },
          ].map(({ label, color, value, min, max, step, onChange, unit }) => (
            <div key={label} style={{ border: `1px solid #1a2332`, borderLeft: `3px solid ${color}`, background: '#0d1420', padding: '0.5rem 0.6rem', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color }}>{label}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{value}{unit}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={!isPlanning}
                onChange={e => onChange(Number(e.target.value))}
                style={{ opacity: isPlanning ? 1 : 0.35 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '0.5rem', color: '#556677' }}>{min}</span>
                <span style={{ fontSize: '0.5rem', color: '#556677' }}>{max}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div
          style={{
            border: '1px solid #1a2332',
            background: '#0d1420',
            padding: '0.6rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
            MISSION PACKAGE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
              <span style={{ color: '#ffd600' }}>◆ Bait LUCAS Drones</span>
              <span style={{ color: '#c5cdd8' }}>{numBait}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
              <span style={{ color: '#76ff03' }}>● LUCAS Strike</span>
              <span style={{ color: '#c5cdd8' }}>{numReceiver}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
              <span style={{ color: '#00e5ff' }}>⬠ Camera Drones</span>
              <span style={{ color: '#c5cdd8' }}>{numCamera}</span>
            </div>
            <div style={{ height: 1, background: '#1a2332', margin: '0.2rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
              <span style={{ color: '#556677' }}>TOTAL SORTIES</span>
              <span style={{ color: '#00e5ff', fontWeight: 700 }}>{totalDrones}</span>
            </div>
          </div>
        </div>

        {/* Bait doctrine reminder */}
        {isPlanning && (
          <div
            style={{
              border: '1px solid #2a3a4e',
              padding: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.55rem',
              color: '#556677',
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: '#ffab00', marginBottom: '0.3rem', letterSpacing: '0.08em' }}>
              ▸ BAIT DRONE DOCTRINE
            </div>
            <div>Bait drones fly fast (200 mph) into threat zones, depleting SAM missiles. LUCAS strike drones home on revealed radar emitters.</div>
          </div>
        )}

        {/* Execution status */}
        {(isExec || isReady || isComplete) && gameState && (
          <div
            style={{
              border: '1px solid #1a2332',
              background: '#0d1420',
              padding: '0.6rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
              FORCE STATUS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
                <span style={{ color: '#556677' }}>DRONES ALIVE</span>
                <span style={{ color: '#76ff03', fontWeight: 700 }}>
                  {gameState.drones_alive} / {gameState.drones_total}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
                <span style={{ color: '#556677' }}>SCORE</span>
                <span style={{ color: '#00e5ff', fontWeight: 700 }}>{gameState.score}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem' }}>
                <span style={{ color: '#556677' }}>TICK</span>
                <span style={{ color: '#c5cdd8' }}>{gameState.tick} / 60</span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {isPlanning && (
            <>
              <button className="btn-tac btn-primary" onClick={onLaunchAll} style={{ width: '100%' }}>
                ▶ LAUNCH ALL
              </button>
              <button className="btn-tac btn-accent" onClick={onInitialize} style={{ width: '100%' }}>
                ⬡ INITIALIZE ONLY
              </button>
            </>
          )}

          {isReady && (
            <>
              <button className="btn-tac btn-primary" onClick={onExecute} style={{ width: '100%' }}>
                ▶ EXECUTE MISSION
              </button>
              <button className="btn-tac btn-accent" onClick={onFullRun} style={{ width: '100%' }}>
                ⚡ FULL RUN
              </button>
            </>
          )}

          {isExec && (
            <button className="btn-tac btn-accent" onClick={onFullRun} disabled={isExecuting} style={{ width: '100%' }}>
              ⚡ FULL RUN
            </button>
          )}

          {(isReady || isExec || isComplete) && (
            <button className="btn-tac btn-muted" onClick={onReset} style={{ width: '100%' }}>
              ↩ NEW SCENARIO
            </button>
          )}
        </div>

        {/* Enemy legend */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            ADVERSARY LEGEND
          </div>
          {[
            { color: '#ffab00', shape: '◆', label: 'EWR / Radar', sub: '100 NM detect, drifts' },
            { color: '#ff1744', shape: '▲', label: 'SAM Launcher', sub: 'Radar-cued, 2 missiles, hidden' },
            { color: '#ff9800', shape: '■', label: 'Fuel / Supply', sub: 'Strike target' },
          ].map(({ color, shape, label, sub }) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', fontSize: '0.6rem' }}
            >
              <span style={{ color, fontSize: '0.8rem', width: 14, textAlign: 'center' }}>{shape}</span>
              <div>
                <span style={{ color: '#c5cdd8' }}>{label}</span>
                <span style={{ color: '#556677', marginLeft: 6 }}>{sub}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </aside>
  );
}
