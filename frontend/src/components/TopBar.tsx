'use client';

import Link from 'next/link';
import type { GamePhase } from '@/lib/types';
import { PHASE_LABELS, PHASE_COLORS } from '@/lib/constants';

interface TopBarProps {
  phase: GamePhase;
  tick: number;
  maxTicks: number;
  backendAvailable: boolean | null;
  showThreatRings: boolean;
  showDetected: boolean;
  onToggleThreatRings: () => void;
  onToggleDetected: () => void;
}

function Toggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`toggle-switch ${active ? 'active' : ''}`}
      style={{ background: 'none', border: 'none', padding: 0 }}
    >
      <div className="toggle-dot" />
      <span>{label}</span>
    </button>
  );
}

export default function TopBar({
  phase,
  tick,
  maxTicks,
  backendAvailable,
  showThreatRings,
  showDetected,
  onToggleThreatRings,
  onToggleDetected,
}: TopBarProps) {
  const phaseColor = PHASE_COLORS[phase] ?? '#556677';
  const phaseLabel = PHASE_LABELS[phase] ?? phase;
  const progressPct = maxTicks > 0 ? (tick / maxTicks) * 100 : 0;

  return (
    <header
      style={{
        background: '#0d1420',
        borderBottom: '1px solid #1a2332',
        display: 'flex',
        alignItems: 'center',
        height: 56,
        paddingLeft: 16,
        paddingRight: 16,
        gap: 16,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Progress bar underlay */}
      {phase === 'EXECUTION' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 2,
            width: `${progressPct}%`,
            background: '#76ff03',
            transition: 'width 0.5s linear',
          }}
        />
      )}

      {/* Brand */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
        <span
          style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #ff1744, #ff6e40)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          D³AS
        </span>
        <span
          style={{
            fontSize: '0.55rem',
            letterSpacing: '0.16em',
            color: '#556677',
            textTransform: 'uppercase',
          }}
        >
          Data Driven Distributed Autonomous Systems
        </span>
      </Link>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: '#1a2332' }} />

      {/* Phase badge */}
      <div
        className="phase-badge"
        style={{
          color: phaseColor,
          borderColor: phaseColor,
          animation: phase === 'EXECUTION' ? 'blink 1.5s ease-in-out infinite' : 'none',
        }}
      >
        {phaseLabel}
      </div>

      {/* Tick counter */}
      {(phase === 'EXECUTION' || phase === 'COMPLETE' || phase === 'READY') && (
        <div
          style={{
            fontSize: '0.65rem',
            color: '#c5cdd8',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: '#556677' }}>T+</span>
          <span style={{ color: '#00e5ff', fontWeight: 700, minWidth: '2ch' }}>{tick}</span>
          <span style={{ color: '#556677' }}>/ {maxTicks}</span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 20 }}>
        <Toggle label="Threat Rings" active={showThreatRings} onToggle={onToggleThreatRings} />
        <Toggle label="Detected Only" active={showDetected} onToggle={onToggleDetected} />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: '#1a2332' }} />

      {/* Backend status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background:
              backendAvailable === null
                ? '#ffab00'
                : backendAvailable
                ? '#76ff03'
                : '#ff1744',
            animation:
              backendAvailable === null ? 'blink 0.8s ease-in-out infinite' : 'none',
          }}
        />
        <span style={{ fontSize: '0.6rem', color: '#556677', letterSpacing: '0.08em' }}>
          {backendAvailable === null
            ? 'CHECKING'
            : backendAvailable
            ? 'BACKEND ONLINE'
            : 'BACKEND OFFLINE'}
        </span>
      </div>
    </header>
  );
}
