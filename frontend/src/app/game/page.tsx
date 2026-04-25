'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GamePhase, GameState, SimEvent, PingEffect, RadarPingEvent } from '@/lib/types';
import { healthCheck, startSim, tickSim, runSim } from '@/lib/api';
import { initClientSim, advanceClientTick, getPublicState } from '@/lib/simulation';
import type { ISimState } from '@/lib/simulation';
import TopBar from '@/components/TopBar';
import AssetPalette from '@/components/AssetPalette';
import TacticalMap from '@/components/TacticalMap';
import MissionLog from '@/components/MissionLog';
import BDAPanel from '@/components/BDAPanel';

export default function GamePage() {
  const [phase, setPhase] = useState<GamePhase>('PLANNING');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [numBait, setNumBait] = useState(8);
  const [numReceiver, setNumReceiver] = useState(8);
  const [allEvents, setAllEvents] = useState<SimEvent[]>([]);
  const [activePings, setActivePings] = useState<PingEffect[]>([]);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showThreatRings, setShowThreatRings] = useState(true);
  const [showDetected, setShowDetected] = useState(true);

  const lastTickRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clientSimRef = useRef<ISimState | null>(null);
  const phaseRef = useRef<GamePhase>('PLANNING');
  phaseRef.current = phase;

  // Check backend availability on mount
  useEffect(() => {
    healthCheck().then(ok => setBackendAvailable(ok));
  }, []);

  const processNewEvents = useCallback((state: GameState) => {
    const newEvts = state.events.filter(e => e.tick > lastTickRef.current);
    lastTickRef.current = state.tick;

    if (newEvts.length > 0) {
      setAllEvents(prev => [...prev, ...newEvts]);

      const pings = newEvts
        .filter((e): e is RadarPingEvent => e.type === 'radar_ping')
        .map(e => ({
          id: `${e.radar_id}-${e.tick}-${Math.random().toString(36).slice(2, 7)}`,
          x: e.x,
          y: e.y,
        }));

      if (pings.length > 0) {
        setActivePings(prev => [...prev, ...pings]);
        const ids = pings.map(p => p.id);
        setTimeout(() => {
          setActivePings(prev => prev.filter(p => !ids.includes(p.id)));
        }, 2200);
      }
    }
  }, []);

  const applyState = useCallback(
    (state: GameState) => {
      setGameState(state);
      processNewEvents(state);
    },
    [processNewEvents]
  );

  const handleInitialize = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    lastTickRef.current = 0;
    setAllEvents([]);
    setActivePings([]);
    setGameState(null);

    if (backendAvailable) {
      try {
        const state = await startSim(numBait, numReceiver);
        setGameState(state);
        setPhase('READY');
        return;
      } catch {
        // fall through to client sim
      }
    }

    // Client-side fallback
    const sim = initClientSim(numBait, numReceiver);
    clientSimRef.current = sim;
    setGameState(getPublicState(sim));
    setPhase('READY');
  }, [backendAvailable, numBait, numReceiver]);

  const runClientTick = useCallback(() => {
    if (!clientSimRef.current) return;
    advanceClientTick(clientSimRef.current);
    const state = getPublicState(clientSimRef.current);
    applyState(state);
    if (state.complete) {
      setPhase('COMPLETE');
      setIsExecuting(false);
    }
  }, [applyState]);

  const handleExecute = useCallback(() => {
    if (phase !== 'READY') return;
    setPhase('EXECUTION');
    setIsExecuting(true);
  }, [phase]);

  // Execution loop
  useEffect(() => {
    if (phase !== 'EXECUTION') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const tick = async () => {
      if (phaseRef.current !== 'EXECUTION') return;

      if (backendAvailable) {
        try {
          const result = await tickSim(1);
          applyState(result.state);
          if (result.state.complete) {
            setPhase('COMPLETE');
            setIsExecuting(false);
          }
          return;
        } catch {
          // fall through to client tick
        }
      }

      runClientTick();
    };

    intervalRef.current = setInterval(tick, 600);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase, backendAvailable, applyState, runClientTick]);

  const handleFullRun = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsExecuting(false);

    if (backendAvailable) {
      try {
        const state = await runSim();
        setGameState(state);
        setAllEvents(state.events);
        lastTickRef.current = state.tick;
        setPhase('COMPLETE');
        return;
      } catch {
        // fall through
      }
    }

    // Client full run
    if (clientSimRef.current) {
      while (!clientSimRef.current.complete) {
        advanceClientTick(clientSimRef.current);
      }
      const state = getPublicState(clientSimRef.current);
      setGameState(state);
      setAllEvents(state.events);
      lastTickRef.current = state.tick;
      setPhase('COMPLETE');
    }
  }, [backendAvailable]);

  const handleReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPhase('PLANNING');
    setGameState(null);
    setAllEvents([]);
    setActivePings([]);
    lastTickRef.current = 0;
    clientSimRef.current = null;
    setIsExecuting(false);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0a0e14',
        overflow: 'hidden',
      }}
    >
      <TopBar
        phase={phase}
        tick={gameState?.tick ?? 0}
        maxTicks={60}
        backendAvailable={backendAvailable}
        showThreatRings={showThreatRings}
        showDetected={showDetected}
        onToggleThreatRings={() => setShowThreatRings(v => !v)}
        onToggleDetected={() => setShowDetected(v => !v)}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <AssetPalette
          phase={phase}
          numBait={numBait}
          numReceiver={numReceiver}
          onNumBaitChange={setNumBait}
          onNumReceiverChange={setNumReceiver}
          onInitialize={handleInitialize}
          onExecute={handleExecute}
          onFullRun={handleFullRun}
          onReset={handleReset}
          gameState={gameState}
          isExecuting={isExecuting}
        />

        <TacticalMap
          gameState={gameState}
          activePings={activePings}
          showThreatRings={showThreatRings}
          showDetected={showDetected}
        />

        {/* Right panel */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #1a2332',
            background: '#0a0e14',
            overflow: 'hidden',
          }}
        >
          <BDAPanel gameState={gameState} />
          <MissionLog events={allEvents} />
        </div>
      </div>

      {/* COMPLETE overlay */}
      {phase === 'COMPLETE' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,14,20,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }}
          onClick={handleReset}
        >
          <div
            style={{
              background: '#0d1420',
              border: '1px solid #1a2332',
              borderTop: '3px solid #76ff03',
              padding: '2rem 3rem',
              textAlign: 'center',
              minWidth: 360,
              animation: 'slide-up 0.4s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.2em',
                color: '#76ff03',
                marginBottom: '0.5rem',
              }}
            >
              MISSION COMPLETE
            </div>
            <div
              style={{
                fontSize: '3rem',
                fontWeight: 900,
                color: '#00e5ff',
                lineHeight: 1,
                marginBottom: '0.5rem',
              }}
            >
              {gameState?.score ?? 0}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#556677', marginBottom: '1.5rem' }}>
              TOTAL SCORE
            </div>

            <div
              style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'center',
                marginBottom: '1.5rem',
                fontSize: '0.65rem',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#76ff03', fontWeight: 700, fontSize: '1.4rem' }}>
                  {(gameState?.entities.radars.filter(r => r.destroyed).length ?? 0) +
                    (gameState?.entities.gas_targets.filter(t => t.destroyed).length ?? 0)}
                </div>
                <div style={{ color: '#556677' }}>TARGETS DESTROYED</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ff1744', fontWeight: 700, fontSize: '1.4rem' }}>
                  {(gameState?.drones_total ?? 0) - (gameState?.drones_alive ?? 0)}
                </div>
                <div style={{ color: '#556677' }}>DRONES LOST</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-tac btn-accent" onClick={handleReset}>
                ↩ NEW SCENARIO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
