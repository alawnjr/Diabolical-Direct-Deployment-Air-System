'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GamePhase, GameState, SimEvent, PingEffect, RadarPingEvent } from '@/lib/types';
import { healthCheck, startSim, tickSim, runSim } from '@/lib/api';
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
  const [radarRange, setRadarRange] = useState(100);
  const [samRange, setSamRange] = useState(25);
  const [allEvents, setAllEvents] = useState<SimEvent[]>([]);
  const [activePings, setActivePings] = useState<PingEffect[]>([]);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showThreatRings, setShowThreatRings] = useState(true);
  const [showDetected, setShowDetected] = useState(true);

  const lastTickRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<GamePhase>('PLANNING');
  phaseRef.current = phase;

  const checkBackend = useCallback(() => {
    setBackendAvailable(null);
    healthCheck().then(ok => {
      setBackendAvailable(ok);
      if (!ok) setBackendError('Backend server is offline. Start the Flask server and retry.');
    });
  }, []);

  // Initial check
  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  // Auto-reconnect poll every 5 seconds while offline
  useEffect(() => {
    if (backendAvailable !== false) return;
    const id = setInterval(() => {
      healthCheck().then(ok => {
        if (ok) {
          setBackendAvailable(true);
          setBackendError(null);
        }
      });
    }, 5000);
    return () => clearInterval(id);
  }, [backendAvailable]);

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

  const stopExecution = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsExecuting(false);
  }, []);

  const handleInitialize = useCallback(async () => {
    if (!backendAvailable) {
      setBackendError('Backend server is offline. Start the Flask server and retry.');
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    lastTickRef.current = 0;
    setAllEvents([]);
    setActivePings([]);
    setGameState(null);
    setBackendError(null);

    try {
      const state = await startSim(numBait, numReceiver, radarRange, samRange);
      setGameState(state);
      setPhase('READY');
    } catch {
      setBackendError('Failed to initialize simulation. Check that the backend server is running.');
    }
  }, [backendAvailable, numBait, numReceiver]);

  const handleExecute = useCallback(() => {
    if (phase !== 'READY') return;
    setPhase('EXECUTION');
    setIsExecuting(true);
  }, [phase]);

  const handleLaunchAll = useCallback(async () => {
    if (!backendAvailable) {
      setBackendError('Backend server is offline. Start the Flask server and retry.');
      return;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    lastTickRef.current = 0;
    setAllEvents([]);
    setActivePings([]);
    setGameState(null);
    setBackendError(null);
    try {
      const state = await startSim(numBait, numReceiver, radarRange, samRange);
      setGameState(state);
      setPhase('EXECUTION');
      setIsExecuting(true);
    } catch {
      setBackendError('Failed to launch mission. Check that the backend server is running.');
    }
  }, [backendAvailable, numBait, numReceiver, radarRange, samRange]);

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

      try {
        const result = await tickSim(1);
        applyState(result.state);
        if (result.state.complete) {
          setPhase('COMPLETE');
          setIsExecuting(false);
        }
      } catch {
        stopExecution();
        setPhase('READY');
        setBackendError('Lost connection to the backend mid-execution. Check the Flask server and resume.');
      }
    };

    intervalRef.current = setInterval(tick, 600);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase, applyState, stopExecution]);

  const handleFullRun = useCallback(async () => {
    stopExecution();

    try {
      const state = await runSim();
      setGameState(state);
      setAllEvents(state.events);
      lastTickRef.current = state.tick;
      setPhase('COMPLETE');
    } catch {
      setBackendError('Failed to run simulation. Check that the backend server is running.');
    }
  }, [stopExecution]);

  const handleReset = useCallback(() => {
    stopExecution();
    setPhase('PLANNING');
    setGameState(null);
    setAllEvents([]);
    setActivePings([]);
    lastTickRef.current = 0;
    setBackendError(null);
  }, [stopExecution]);

  const handleRetryConnection = useCallback(() => {
    setBackendError(null);
    checkBackend();
  }, [checkBackend]);

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
          radarRange={radarRange}
          samRange={samRange}
          onNumBaitChange={setNumBait}
          onNumReceiverChange={setNumReceiver}
          onRadarRangeChange={setRadarRange}
          onSamRangeChange={setSamRange}
          onInitialize={handleInitialize}
          onLaunchAll={handleLaunchAll}
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
          onToggleThreatRings={() => setShowThreatRings(v => !v)}
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

      {/* Backend error overlay */}
      {backendError && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,14,20,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#0d1420',
              border: '1px solid #1a2332',
              borderTop: '3px solid #ff1744',
              padding: '2rem 3rem',
              textAlign: 'center',
              minWidth: 360,
              maxWidth: 480,
              animation: 'slide-up 0.3s ease-out',
            }}
          >
            <div
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.2em',
                color: '#ff1744',
                marginBottom: '0.75rem',
              }}
            >
              BACKEND OFFLINE
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#c5cdd8',
                lineHeight: 1.6,
                marginBottom: '1.5rem',
              }}
            >
              {backendError}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-tac btn-primary" onClick={handleRetryConnection}>
                ↺ RETRY CONNECTION
              </button>
              <button className="btn-tac btn-muted" onClick={() => setBackendError(null)}>
                ✕ DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

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
