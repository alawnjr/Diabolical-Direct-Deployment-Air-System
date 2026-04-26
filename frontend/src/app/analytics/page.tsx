'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  MATCHUPS,
  ATTACK_STATS,
  DEFENSE_STATS,
  OPTIMAL_COUNTERS,
  ATTACK_ALGORITHMS,
  DEFENSE_ALGORITHMS,
  MAX_POSSIBLE_SCORE,
  SIM_RUNS_PER_PAIR,
  type AttackAlgorithm,
  type DefenseAlgorithm,
} from '@/lib/analytics-data';

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function pctToColor(pct: number): string {
  // 0% → #d50000, 50% → #ffab00, 100% → #76ff03
  const t = Math.max(0, Math.min(1, pct / 100));
  if (t < 0.5) {
    const s = t * 2;
    const r = Math.round(213 + (255 - 213) * s);
    const g = Math.round(0   + (171 - 0)   * s);
    const b = 0;
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) * 2;
  const r = Math.round(255 + (118 - 255) * s);
  const g = Math.round(171 + (255 - 171) * s);
  const b = Math.round(0   + (3   - 0)   * s);
  return `rgb(${r},${g},${b})`;
}

function labelFor(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{
        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em',
        color: '#556677', marginBottom: '0.25rem',
      }}>
        {sub ?? 'ANALYTICS'}
      </div>
      <div style={{
        fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em',
        color: '#c5cdd8', borderBottom: '1px solid #1a2332', paddingBottom: '0.5rem',
      }}>
        {title}
      </div>
    </div>
  );
}

function HeroCard({
  label, value, sub, color = '#00e5ff',
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#0d1420', border: '1px solid #1a2332',
      padding: '1rem 1.25rem', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: '0.55rem', letterSpacing: '0.16em', color: '#556677', marginBottom: '0.4rem' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1.1, wordBreak: 'break-word' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.55rem', letterSpacing: '0.08em', color: '#556677', marginTop: '0.3rem' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap cell tooltip
// ---------------------------------------------------------------------------

function HeatCell({
  matchup, cellSize,
}: { matchup: typeof MATCHUPS[number]; cellSize: number }) {
  const [hovered, setHovered] = useState(false);
  const pct = matchup.avg_destruction_rate;
  const bg = pctToColor(pct);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: cellSize, height: cellSize,
        background: bg, opacity: hovered ? 1 : 0.85,
        position: 'relative', cursor: 'default',
        transition: 'opacity 0.1s',
        outline: hovered ? '1px solid #fff' : undefined,
      }}
    >
      {hovered && (
        <div style={{
          position: 'absolute', zIndex: 10, bottom: cellSize + 2, left: '50%',
          transform: 'translateX(-50%)',
          background: '#0a0e14', border: '1px solid #2a3a4e',
          padding: '0.4rem 0.6rem', whiteSpace: 'nowrap',
          fontSize: '0.6rem', lineHeight: 1.5, pointerEvents: 'none',
        }}>
          <div style={{ color: '#c5cdd8', fontWeight: 700 }}>
            {labelFor(matchup.attack)}
          </div>
          <div style={{ color: '#556677' }}>vs {labelFor(matchup.defense)}</div>
          <div style={{ color: bg, marginTop: '0.2rem' }}>
            {pct.toFixed(1)}% destroyed · avg {matchup.avg_score.toFixed(1)}/{MAX_POSSIBLE_SCORE}
          </div>
          <div style={{ color: '#556677' }}>
            Drones lost: {matchup.avg_drones_lost.toFixed(1)} · Eff: {matchup.efficiency.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap grid
// ---------------------------------------------------------------------------

function Heatmap() {
  const CELL = 40;
  const labelW = 140;
  const labelH = 80;

  const lookup = useMemo(() => {
    const m: Record<string, Record<string, typeof MATCHUPS[number]>> = {};
    for (const atk of ATTACK_ALGORITHMS) {
      m[atk] = {};
      for (const dfn of DEFENSE_ALGORITHMS) {
        const found = MATCHUPS.find(x => x.attack === atk && x.defense === dfn);
        if (found) m[atk][dfn] = found;
      }
    }
    return m;
  }, []);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block', minWidth: labelW + DEFENSE_ALGORITHMS.length * CELL }}>

        {/* Top labels (defense) */}
        <div style={{ display: 'flex', marginLeft: labelW }}>
          {DEFENSE_ALGORITHMS.map(dfn => (
            <div key={dfn} style={{
              width: CELL, height: labelH,
              fontSize: '0.45rem', letterSpacing: '0.06em', color: '#556677',
              writingMode: 'vertical-rl', textOrientation: 'mixed',
              transform: 'rotate(180deg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textTransform: 'uppercase',
            }}>
              {labelFor(dfn)}
            </div>
          ))}
        </div>

        {/* Rows */}
        {ATTACK_ALGORITHMS.map(atk => (
          <div key={atk} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Left label */}
            <div style={{
              width: labelW, flexShrink: 0,
              fontSize: '0.55rem', letterSpacing: '0.08em', color: '#c5cdd8',
              textAlign: 'right', paddingRight: '0.75rem', textTransform: 'uppercase',
            }}>
              {labelFor(atk)}
            </div>
            {/* Cells */}
            {DEFENSE_ALGORITHMS.map(dfn => {
              const m = lookup[atk]?.[dfn];
              if (!m) return <div key={dfn} style={{ width: CELL, height: CELL, background: '#1a2332' }} />;
              return <HeatCell key={dfn} matchup={m} cellSize={CELL} />;
            })}
          </div>
        ))}

        {/* Color scale legend */}
        <div style={{ marginLeft: labelW, marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.5rem', color: '#556677', letterSpacing: '0.1em' }}>0%</div>
          <div style={{
            flex: 1, height: 8,
            background: 'linear-gradient(to right, #d50000, #ffab00, #76ff03)',
          }} />
          <div style={{ fontSize: '0.5rem', color: '#556677', letterSpacing: '0.1em' }}>100%</div>
          <div style={{ fontSize: '0.5rem', color: '#556677', letterSpacing: '0.1em', marginLeft: '0.5rem' }}>
            DESTRUCTION RATE
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar chart
// ---------------------------------------------------------------------------

function BarChart({
  data, color, label, maxVal,
}: {
  data: { name: string; value: number }[];
  color: string;
  label: string;
  maxVal: number;
}) {
  return (
    <div>
      {data.map(({ name, value }) => (
        <div key={name} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.06em', color: '#c5cdd8', textTransform: 'uppercase' }}>
              {labelFor(name)}
            </span>
            <span style={{ fontSize: '0.6rem', color, fontWeight: 700 }}>
              {value.toFixed(1)}{label}
            </span>
          </div>
          <div style={{ height: 6, background: '#1a2332', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(value / maxVal) * 100}%`,
              background: color, borderRadius: 2,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matchup detail panel
// ---------------------------------------------------------------------------

function MatchupDetail({
  attack, defense,
}: { attack: AttackAlgorithm | null; defense: DefenseAlgorithm | null }) {
  if (!attack || !defense) {
    return (
      <div style={{
        padding: '1.5rem', color: '#556677', fontSize: '0.65rem',
        letterSpacing: '0.1em', textAlign: 'center',
        border: '1px dashed #1a2332', marginTop: '1rem',
      }}>
        SELECT AN ATTACK + DEFENSE PAIR TO INSPECT
      </div>
    );
  }
  const m = MATCHUPS.find(x => x.attack === attack && x.defense === defense);
  if (!m) return null;
  const pct = m.avg_destruction_rate;
  const c = pctToColor(pct);

  const rows: [string, string, string?][] = [
    ['Avg Score', `${m.avg_score.toFixed(2)} / ${MAX_POSSIBLE_SCORE}`, undefined],
    ['Destruction Rate', `${pct.toFixed(1)}%`, undefined],
    ['Score Std Dev', `±${m.std_score.toFixed(2)}`, undefined],
    ['Radars Destroyed', m.avg_radars_destroyed.toFixed(2), '/6'],
    ['Launchers Killed', m.avg_launchers_destroyed.toFixed(2), '/6'],
    ['Gas Targets Hit', m.avg_gas_destroyed.toFixed(2), '/4'],
    ['Drones Lost', m.avg_drones_lost.toFixed(2), `/ ${m.n_runs * 0} (avg)`],
    ['Drone Survival', `${m.avg_drone_survival_rate.toFixed(1)}%`, undefined],
    ['Score / Drone Lost', m.efficiency.toFixed(3), undefined],
    ['First Kill Tick', m.avg_first_kill_tick != null ? m.avg_first_kill_tick.toFixed(1) : '—', undefined],
    ['Sim Runs', `${m.n_runs}${m.n_failed > 0 ? ` (+${m.n_failed} failed)` : ''}`, undefined],
  ];

  return (
    <div style={{
      background: '#0d1420', border: '1px solid #1a2332',
      padding: '1rem', marginTop: '1rem',
    }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: '0.5rem', letterSpacing: '0.14em', color: '#556677' }}>ATTACK</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#76ff03', textTransform: 'uppercase' }}>
            {labelFor(attack)}
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#556677' }}>VS</div>
        <div>
          <div style={{ fontSize: '0.5rem', letterSpacing: '0.14em', color: '#556677' }}>DEFENSE</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ff1744', textTransform: 'uppercase' }}>
            {labelFor(defense)}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: c, lineHeight: 1 }}>{pct.toFixed(1)}%</div>
          <div style={{ fontSize: '0.5rem', color: '#556677', letterSpacing: '0.1em' }}>DESTRUCTION</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem' }}>
        {rows.map(([lbl, val, sfx]) => (
          <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a2332', paddingBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.06em' }}>{lbl}</span>
            <span style={{ fontSize: '0.6rem', color: '#c5cdd8', fontWeight: 700 }}>{val}{sfx ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [selectedAttack, setSelectedAttack] = useState<AttackAlgorithm | null>(null);
  const [selectedDefense, setSelectedDefense] = useState<DefenseAlgorithm | null>(null);
  const [sortMetric, setSortMetric] = useState<'avg_destruction_rate' | 'avg_efficiency' | 'avg_drone_survival_rate'>('avg_destruction_rate');

  // Hero metrics
  const bestAttack = Object.entries(ATTACK_STATS)
    .sort((a, b) => b[1].avg_destruction_rate - a[1].avg_destruction_rate)[0];
  const hardestDefense = Object.entries(DEFENSE_STATS)
    .sort((a, b) => a[1].avg_score_allowed - b[1].avg_score_allowed)[0];
  const overallAvgDestr = MATCHUPS.reduce((s, m) => s + m.avg_destruction_rate, 0) / MATCHUPS.length;
  const bestEfficiency = Object.entries(ATTACK_STATS)
    .sort((a, b) => b[1].avg_efficiency - a[1].avg_efficiency)[0];
  const fastestKill = MATCHUPS.filter(m => m.avg_first_kill_tick != null)
    .sort((a, b) => (a.avg_first_kill_tick ?? 999) - (b.avg_first_kill_tick ?? 999))[0];

  // Attack rankings
  const attackRanked = [...ATTACK_ALGORITHMS].sort(
    (a, b) => ATTACK_STATS[b][sortMetric] - ATTACK_STATS[a][sortMetric]
  );
  const attackMaxVal = Math.max(...ATTACK_ALGORITHMS.map(a => ATTACK_STATS[a][sortMetric]));

  // Defense rankings (lower avg score allowed = better defense)
  const defenseRanked = [...DEFENSE_ALGORITHMS].sort(
    (a, b) => DEFENSE_STATS[a].avg_score_allowed - DEFENSE_STATS[b].avg_score_allowed
  );
  const defenseMaxVal = Math.max(...DEFENSE_ALGORITHMS.map(d => DEFENSE_STATS[d].avg_score_allowed));

  // Per-defense optimal counter, sorted by defense resilience
  const countersRanked = [...OPTIMAL_COUNTERS].sort(
    (a, b) => a.avg_score - b.avg_score
  );

  const metricLabel: Record<typeof sortMetric, string> = {
    avg_destruction_rate: '%',
    avg_efficiency: ' pts/drone',
    avg_drone_survival_rate: '%',
  };

  return (
    <div style={{ background: '#0a0e14', minHeight: '100vh', color: '#c5cdd8' }}>

      {/* Classification banner */}
      <div style={{
        background: '#ff1744', color: '#fff', textAlign: 'center',
        fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.2em', padding: '5px',
      }}>
        EXERCISE // UNCLASSIFIED // FOR TRAINING PURPOSES ONLY
      </div>

      {/* Top bar */}
      <div style={{
        background: '#0d1420', borderBottom: '1px solid #1a2332',
        padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize: '1.1rem', fontWeight: 900,
            background: 'linear-gradient(135deg, #ff1744, #ff6e40)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>D³AS</span>
        </Link>
        <div style={{ width: 1, height: 20, background: '#1a2332' }} />
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: '#ffab00' }}>
          SIMULATION ANALYTICS
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em' }}>
            {ATTACK_ALGORITHMS.length} ATTACK × {DEFENSE_ALGORITHMS.length} DEFENSE ·{' '}
            {SIM_RUNS_PER_PAIR} RUNS/PAIR · {ATTACK_ALGORITHMS.length * DEFENSE_ALGORITHMS.length * SIM_RUNS_PER_PAIR} TOTAL SIMS
          </div>
          <Link href="/game">
            <button className="btn-tac btn-primary" style={{ fontSize: '0.6rem', padding: '0.3rem 0.8rem' }}>
              ▶ LAUNCH SIM
            </button>
          </Link>
        </div>
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 1600, margin: '0 auto' }}>

        {/* ── Hero cards ── */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <HeroCard
            label="Best Attack Strategy"
            value={labelFor(bestAttack[0])}
            sub={`${bestAttack[1].avg_destruction_rate.toFixed(1)}% avg destruction`}
            color="#76ff03"
          />
          <HeroCard
            label="Hardest Defense"
            value={labelFor(hardestDefense[0])}
            sub={`allows only ${hardestDefense[1].avg_score_allowed.toFixed(1)} avg pts`}
            color="#ff1744"
          />
          <HeroCard
            label="Overall Avg Destruction"
            value={`${overallAvgDestr.toFixed(1)}%`}
            sub={`across all ${ATTACK_ALGORITHMS.length * DEFENSE_ALGORITHMS.length} matchups`}
            color="#ffab00"
          />
          <HeroCard
            label="Most Efficient Attack"
            value={labelFor(bestEfficiency[0])}
            sub={`${bestEfficiency[1].avg_efficiency.toFixed(2)} pts per drone lost`}
            color="#00e5ff"
          />
          <HeroCard
            label="Fastest First Kill"
            value={fastestKill ? `Tick ${fastestKill.avg_first_kill_tick?.toFixed(1)}` : '—'}
            sub={fastestKill ? `${labelFor(fastestKill.attack)} vs ${labelFor(fastestKill.defense)}` : ''}
            color="#e040fb"
          />
        </div>

        {/* ── Heatmap ── */}
        <div style={{ background: '#0d1420', border: '1px solid #1a2332', padding: '1.25rem', marginBottom: '2rem' }}>
          <SectionHeader title="Matchup Heatmap — Destruction Rate" sub="ATTACK × DEFENSE MATRIX" />
          <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.08em', marginBottom: '1rem' }}>
            Rows = attack algorithm · Columns = defense placement · Color = avg destruction rate · Hover for details
          </div>
          <Heatmap />
        </div>

        {/* ── Rankings row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>

          {/* Attack rankings */}
          <div style={{ background: '#0d1420', border: '1px solid #1a2332', padding: '1.25rem' }}>
            <SectionHeader title="Attack Strategy Rankings" sub="OFFENSIVE PERFORMANCE" />
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {(['avg_destruction_rate', 'avg_efficiency', 'avg_drone_survival_rate'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setSortMetric(m)}
                  className={`btn-tac ${sortMetric === m ? 'btn-primary' : 'btn-muted'}`}
                  style={{ fontSize: '0.5rem', padding: '0.2rem 0.5rem' }}
                >
                  {m === 'avg_destruction_rate' ? 'DESTRUCTION %' :
                   m === 'avg_efficiency' ? 'EFFICIENCY' : 'SURVIVAL %'}
                </button>
              ))}
            </div>
            <BarChart
              data={attackRanked.map(a => ({ name: a, value: ATTACK_STATS[a][sortMetric] }))}
              color="#76ff03"
              label={metricLabel[sortMetric]}
              maxVal={attackMaxVal}
            />
          </div>

          {/* Defense resilience */}
          <div style={{ background: '#0d1420', border: '1px solid #1a2332', padding: '1.25rem' }}>
            <SectionHeader title="Defense Resilience Rankings" sub="RESISTANCE TO ATTACK (LOWER = STRONGER)" />
            <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Avg score allowed — lower is a tougher defense
            </div>
            <BarChart
              data={[...defenseRanked].reverse().map(d => ({
                name: d,
                value: DEFENSE_STATS[d].avg_score_allowed,
              }))}
              color="#ff1744"
              label=" pts"
              maxVal={defenseMaxVal}
            />
          </div>
        </div>

        {/* ── Matchup explorer + optimal counters ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>

          {/* Matchup explorer */}
          <div style={{ background: '#0d1420', border: '1px solid #1a2332', padding: '1.25rem' }}>
            <SectionHeader title="Matchup Explorer" sub="DRILL DOWN" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                  ATTACK ALGORITHM
                </div>
                <select
                  value={selectedAttack ?? ''}
                  onChange={e => setSelectedAttack((e.target.value as AttackAlgorithm) || null)}
                  style={{
                    width: '100%', background: '#111927', border: '1px solid #2a3a4e',
                    color: '#c5cdd8', padding: '0.4rem 0.5rem', fontSize: '0.65rem',
                    fontFamily: 'inherit', letterSpacing: '0.06em',
                  }}
                >
                  <option value="">— select —</option>
                  {ATTACK_ALGORITHMS.map(a => (
                    <option key={a} value={a}>{labelFor(a)}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                  DEFENSE PLACEMENT
                </div>
                <select
                  value={selectedDefense ?? ''}
                  onChange={e => setSelectedDefense((e.target.value as DefenseAlgorithm) || null)}
                  style={{
                    width: '100%', background: '#111927', border: '1px solid #2a3a4e',
                    color: '#c5cdd8', padding: '0.4rem 0.5rem', fontSize: '0.65rem',
                    fontFamily: 'inherit', letterSpacing: '0.06em',
                  }}
                >
                  <option value="">— select —</option>
                  {DEFENSE_ALGORITHMS.map(d => (
                    <option key={d} value={d}>{labelFor(d)}</option>
                  ))}
                </select>
              </div>
            </div>
            <MatchupDetail attack={selectedAttack} defense={selectedDefense} />
          </div>

          {/* Optimal counters table */}
          <div style={{ background: '#0d1420', border: '1px solid #1a2332', padding: '1.25rem' }}>
            <SectionHeader title="Optimal Attack per Defense" sub="COUNTER DOCTRINE" />
            <div style={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              For each adversary defense — best attacking algorithm (sorted by toughest defense first)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.6rem' }}>
              <thead>
                <tr>
                  {['Defense Placement', 'Best Attack', 'Avg Score', 'Destr %'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: '0.5rem', letterSpacing: '0.1em',
                      color: '#556677', borderBottom: '1px solid #1a2332',
                      padding: '0.3rem 0.4rem', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {countersRanked.map(row => (
                  <tr
                    key={row.defense}
                    style={{ borderBottom: '1px solid #111927', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedAttack(row.best_attack);
                      setSelectedDefense(row.defense);
                    }}
                  >
                    <td style={{ padding: '0.35rem 0.4rem', color: '#ff6e40', textTransform: 'uppercase' }}>
                      {labelFor(row.defense)}
                    </td>
                    <td style={{ padding: '0.35rem 0.4rem', color: '#76ff03', textTransform: 'uppercase' }}>
                      {labelFor(row.best_attack)}
                    </td>
                    <td style={{ padding: '0.35rem 0.4rem', color: '#ffab00', fontWeight: 700 }}>
                      {row.avg_score.toFixed(1)}/{MAX_POSSIBLE_SCORE}
                    </td>
                    <td style={{ padding: '0.35rem 0.4rem' }}>
                      <span style={{ color: pctToColor(row.avg_destruction_rate), fontWeight: 700 }}>
                        {row.avg_destruction_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Per-attack summary table ── */}
        <div style={{ background: '#0d1420', border: '1px solid #1a2332', padding: '1.25rem', marginBottom: '2rem' }}>
          <SectionHeader title="Full Attack Algorithm Summary" sub="COMPREHENSIVE STATS" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  {['Algorithm', 'Avg Score', 'Destr %', 'Drones Lost', 'Survival %', 'Efficiency', 'Toughest Match', 'Easiest Match'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: '0.5rem', letterSpacing: '0.1em',
                      color: '#556677', borderBottom: '1px solid #1a2332',
                      padding: '0.4rem 0.6rem', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ATTACK_ALGORITHMS]
                  .sort((a, b) => ATTACK_STATS[b].avg_destruction_rate - ATTACK_STATS[a].avg_destruction_rate)
                  .map((atk, i) => {
                    const s = ATTACK_STATS[atk];
                    const rank = i + 1;
                    return (
                      <tr key={atk} style={{ borderBottom: '1px solid #111927' }}>
                        <td style={{ padding: '0.4rem 0.6rem' }}>
                          <span style={{ color: '#556677', marginRight: '0.4rem' }}>#{rank}</span>
                          <span style={{ color: '#c5cdd8', textTransform: 'uppercase' }}>{labelFor(atk)}</span>
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#ffab00', fontWeight: 700 }}>
                          {s.avg_score.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700 }}>
                          <span style={{ color: pctToColor(s.avg_destruction_rate) }}>
                            {s.avg_destruction_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#ff6e40' }}>
                          {s.avg_drones_lost.toFixed(1)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#00e5ff' }}>
                          {s.avg_drone_survival_rate.toFixed(1)}%
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#e040fb' }}>
                          {s.avg_efficiency.toFixed(3)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#ff1744', textTransform: 'uppercase' }}>
                          {labelFor(s.worst_defense)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#76ff03', textTransform: 'uppercase' }}>
                          {labelFor(s.best_defense)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Defense summary table ── */}
        <div style={{ background: '#0d1420', border: '1px solid #1a2332', padding: '1.25rem', marginBottom: '2rem' }}>
          <SectionHeader title="Full Defense Placement Summary" sub="DEFENSIVE PERFORMANCE" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  {['Placement', 'Avg Pts Allowed', 'Avg Destr %', 'Best Counter', 'Worst Counter', 'Score Range'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: '0.5rem', letterSpacing: '0.1em',
                      color: '#556677', borderBottom: '1px solid #1a2332',
                      padding: '0.4rem 0.6rem', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...DEFENSE_ALGORITHMS]
                  .sort((a, b) => DEFENSE_STATS[a].avg_score_allowed - DEFENSE_STATS[b].avg_score_allowed)
                  .map((dfn, i) => {
                    const s = DEFENSE_STATS[dfn];
                    const rank = i + 1;
                    return (
                      <tr key={dfn} style={{ borderBottom: '1px solid #111927' }}>
                        <td style={{ padding: '0.4rem 0.6rem' }}>
                          <span style={{ color: '#556677', marginRight: '0.4rem' }}>#{rank}</span>
                          <span style={{ color: '#ff6e40', textTransform: 'uppercase' }}>{labelFor(dfn)}</span>
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#ffab00', fontWeight: 700 }}>
                          {s.avg_score_allowed.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700 }}>
                          <span style={{ color: pctToColor(s.avg_destruction_rate_allowed) }}>
                            {s.avg_destruction_rate_allowed.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#76ff03', textTransform: 'uppercase' }}>
                          {labelFor(s.best_attack_against)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#c5cdd8', textTransform: 'uppercase' }}>
                          {labelFor(s.worst_attack_against)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', color: '#556677' }}>
                          {s.best_score_allowed.toFixed(1)} – {s.worst_score_allowed.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #1a2332', paddingTop: '0.75rem',
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.5rem', color: '#556677', letterSpacing: '0.1em',
        }}>
          <span>D³AS v1.0 · SCSP HACKATHON 2026</span>
          <span>
            {ATTACK_ALGORITHMS.length * DEFENSE_ALGORITHMS.length * SIM_RUNS_PER_PAIR} SIMULATIONS ·
            MAX SCORE {MAX_POSSIBLE_SCORE} PTS
          </span>
          <span>CLASSIFICATION: EXERCISE</span>
        </div>
      </div>
    </div>
  );
}
