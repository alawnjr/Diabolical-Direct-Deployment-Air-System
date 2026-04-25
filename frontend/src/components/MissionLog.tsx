'use client';

import { useEffect, useRef } from 'react';
import type { SimEvent } from '@/lib/types';

interface MissionLogProps {
  events: SimEvent[];
}

function classifyEvent(ev: SimEvent): { css: string; icon: string; message: string } {
  switch (ev.type) {
    case 'radar_ping':
      return {
        css: 'detect',
        icon: '📡',
        message: `T+${ev.tick} RADAR PING — ${ev.radar_id.toUpperCase()} @ (${ev.x.toFixed(0)}, ${ev.y.toFixed(0)}) NM`,
      };
    case 'missile_fired':
      return {
        css: 'threat-ev',
        icon: '🚀',
        message: `T+${ev.tick} SAM LAUNCH — ${ev.launcher_id.toUpperCase()} → ${ev.target_drone_id.toUpperCase()}`,
      };
    case 'radar_destroyed':
      return {
        css: 'strike',
        icon: '💥',
        message: `T+${ev.tick} RADAR KILLED — ${ev.radar_id.toUpperCase()} by ${ev.drone_id.toUpperCase()} [+${ev.score_gained}pts]`,
      };
    case 'gas_target_destroyed':
      return {
        css: 'warn',
        icon: '🎯',
        message: `T+${ev.tick} TARGET HIT — ${ev.target_id.toUpperCase()} by ${ev.drone_id.toUpperCase()} [+${ev.score_gained}pts]`,
      };
    default:
      return { css: 'info', icon: '▸', message: `T+${(ev as SimEvent).tick} EVENT` };
  }
}

export default function MissionLog({ events }: MissionLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div
      className="tac-panel"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div className="tac-panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>MISSION LOG</span>
        <span style={{ color: '#00e5ff' }}>{events.length} EVENTS</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: '0.62rem',
          lineHeight: 1.4,
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              padding: '1rem 0.75rem',
              color: '#556677',
              fontSize: '0.6rem',
              textAlign: 'center',
            }}
          >
            — awaiting contact —
          </div>
        ) : (
          events.map((ev, i) => {
            const { css, icon, message } = classifyEvent(ev);
            return (
              <div key={i} className={`log-entry ${css}`}>
                <span style={{ marginRight: 4 }}>{icon}</span>
                {message}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
