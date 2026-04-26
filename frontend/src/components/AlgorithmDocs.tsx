'use client';

const ALGORITHMS = [
  {
    id: 'grid_sweep',
    name: '1. Grid Sweep',
    tagline: 'Systematic horizontal lane coverage',
    description:
      'Each drone is assigned a unique horizontal lane spanning the full map width. Drones fly north/south to their lane, then sweep east-west, reversing at each boundary. Together they tile the entire battlespace.',
    strength: 'Guaranteed complete coverage — no area is missed.',
    weakness: 'Predictable paths; slow to converge once a radar is found.',
    bestFor: 'Unknown enemy positions, first-pass reconnaissance.',
  },
  {
    id: 'spiral_outward',
    name: '2. Spiral Outward',
    tagline: 'Expanding archimedean spiral from launch point',
    description:
      'Drones trace expanding spirals from the origin with staggered starting angles and radii. Coverage grows outward continuously, reaching the map edges near tick 60.',
    strength: 'Dense near-origin coverage; naturally adapts to close threats.',
    weakness: 'Far corners are reached late; irregular coverage at map edges.',
    bestFor: 'Threats concentrated near the launch origin.',
  },
  {
    id: 'saturation_fan',
    name: '3. Saturation Fan',
    tagline: 'Tight 20° cone mass-saturation',
    description:
      'All drones are compressed into a narrow 20° cone centred on 45°. The dense swarm overwhelms SAM missile capacity along one bearing by presenting more targets than missiles available.',
    strength: 'Depletes SAM magazines quickly along a single axis.',
    weakness: 'Leaves the flanks completely uncovered.',
    bestFor: 'Known enemy concentration in the NE corridor; paired with a second wave.',
  },
  {
    id: 'bait_ladder',
    name: '4. Bait Ladder',
    tagline: 'Staggered sequential bait activation',
    description:
      'Bait drones activate one per two ticks in sequence. Each successive bait enters the threat zone after the previous one has absorbed a SAM shot, steadily laddering down the enemy\'s missile stock.',
    strength: 'Preserves bait assets; controls the pace of missile depletion.',
    weakness: 'Slow — it takes 20 ticks before all baits are airborne.',
    bestFor: 'Carefully draining limited SAM magazines before receiver strike.',
  },
  {
    id: 'reload_trap',
    name: '5. Reload Trap',
    tagline: 'Two-wave: bait exhausts SAMs, receivers strike',
    description:
      'Wave 1 (ticks 1–25): only bait drones fly, triggering all SAM shots. Wave 2 (ticks 26–60): baits land and receivers launch into a now-undefended battlespace.',
    strength: 'Receivers fly into a SAM-depleted zone with maximum survivability.',
    weakness: 'Receivers are idle for the first 25 ticks; radar detection is delayed.',
    bestFor: 'Conservative strike when missile depletion is the top priority.',
  },
  {
    id: 'multi_azimuth',
    name: '6. Multi-Azimuth',
    tagline: 'Three simultaneous bearing clusters',
    description:
      'Drones are split into three groups flying on 20°, 45°, and 70° bearings (±4° spread). The three axes hit the map from different angles simultaneously, forcing radar operators to track multiple corridors.',
    strength: 'Harder to intercept; high chance of at least one corridor penetrating.',
    weakness: 'Moderate coverage density per corridor.',
    bestFor: 'When enemy radars and SAMs are spread across the map.',
  },
  {
    id: 'random_walk',
    name: '7. Random Walk',
    tagline: 'Stochastic ±25° heading jitter',
    description:
      'Each tick every drone\'s heading is perturbed by a random ±25°. The unpredictable paths make it harder for SAM systems to lead and intercept targets.',
    strength: 'Highly unpredictable; no two runs are alike.',
    weakness: 'Coverage is patchy; drones may revisit areas or cluster.',
    bestFor: 'Degrading SAM intercept solutions; ECM-style movement.',
  },
  {
    id: 'sector_claim',
    name: '8. Sector Claim',
    tagline: 'Each drone owns and sweeps a grid sector',
    description:
      'The map is divided into a grid of roughly equal sectors (√N × √N). Each drone navigates to its assigned sector and sweeps it in horizontal rows. Sectors are covered in parallel.',
    strength: 'Balanced, systematic coverage; avoids overlapping search areas.',
    weakness: 'Drones must transit to their sector before searching, costing time.',
    bestFor: 'Methodical suppression of a known enemy area of operations.',
  },
  {
    id: 'triangulation',
    name: '9. Triangulation Lite',
    tagline: 'Round-robin distribution to revealed radars',
    description:
      'Once radars are detected, drones are assigned to targets by index (drone 1 → radar 1, drone 2 → radar 2, etc.) so different drones approach the same radar from different angles, enabling rough position triangulation.',
    strength: 'Diverse approach angles; spreads strike sorties across multiple targets.',
    weakness: 'No movement before first radar reveal; requires enemy activity.',
    bestFor: 'Maximising simultaneous multi-target strikes after detection.',
  },
  {
    id: 'hotspot_reinforce',
    name: '10. Hotspot Reinforce',
    tagline: 'Mass concentration on detected radar',
    description:
      'The moment any radar emits, every drone in the fleet turns and navigates directly to it. The full swarm converges on the hotspot, guaranteeing destruction even against heavy SAM defences.',
    strength: 'Overwhelming force concentration; nearly certain kill once detected.',
    weakness: 'All eggs in one basket — other radars are ignored.',
    bestFor: 'High-value single target; eliminating the most dangerous radar first.',
  },
  {
    id: 'scout_fix_finish',
    name: '11. Scout-Fix-Finish Lite',
    tagline: 'Bait scouts; receivers hold then strike',
    description:
      'Bait drones fan out to locate enemy radars. Receiver drones hold at the origin until at least one radar is confirmed, then immediately sprint to the nearest target. This preserves strike assets until the target is fixed.',
    strength: 'Strike drones arrive at max range with full flight budget remaining.',
    weakness: 'Receivers idle early; mission depends on baits surviving long enough.',
    bestFor: 'Precision strike once enemy position is confirmed by reconnaissance.',
  },
  {
    id: 'meta_selector',
    name: '12. Meta Selector',
    tagline: 'Grid Sweep until contact, then Hotspot Reinforce',
    description:
      'Phase 1: all drones execute Grid Sweep to methodically search the map. The moment any radar is revealed, the algorithm switches to Hotspot Reinforce — the entire swarm pivots and rushes the detected emitter.',
    strength: 'Combines reliable search with overwhelming strike; adapts mid-mission.',
    weakness: 'Slightly less efficient than pure sweep or pure reinforce alone.',
    bestFor: 'General-purpose: best default when threat locations are unknown.',
  },
];

interface Props {
  onClose: () => void;
}

export default function AlgorithmDocs({ onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,14,20,0.92)',
        zIndex: 300,
        overflow: 'auto',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0d1420',
          border: '1px solid #1a2332',
          borderTop: '3px solid #00e5ff',
          maxWidth: 800,
          width: '100%',
          animation: 'slide-up 0.25s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #1a2332',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: '#00e5ff', marginBottom: '0.25rem' }}>
              D3AS DOCTRINE
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#c5cdd8', letterSpacing: '0.1em' }}>
              ALGORITHM TECHNIQUES
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #1a2332',
              color: '#556677',
              padding: '0.3rem 0.6rem',
              cursor: 'pointer',
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              fontFamily: 'inherit',
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Algorithm cards */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ALGORITHMS.map(algo => (
            <div
              key={algo.id}
              style={{
                border: '1px solid #1a2332',
                borderLeft: '3px solid #2a3a4e',
                background: '#0a0e14',
                padding: '0.75rem 1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c5cdd8', letterSpacing: '0.06em' }}>
                  {algo.name}
                </div>
                <div style={{ fontSize: '0.55rem', color: '#00e5ff', letterSpacing: '0.1em' }}>
                  {algo.tagline.toUpperCase()}
                </div>
              </div>
              <p style={{ fontSize: '0.62rem', color: '#8899aa', lineHeight: 1.65, margin: '0 0 0.5rem' }}>
                {algo.description}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem' }}>
                <div style={{ fontSize: '0.58rem' }}>
                  <span style={{ color: '#76ff03', fontWeight: 700 }}>✓ </span>
                  <span style={{ color: '#556677' }}>{algo.strength}</span>
                </div>
                <div style={{ fontSize: '0.58rem' }}>
                  <span style={{ color: '#ff1744', fontWeight: 700 }}>✗ </span>
                  <span style={{ color: '#556677' }}>{algo.weakness}</span>
                </div>
                <div style={{ fontSize: '0.58rem', gridColumn: '1 / -1' }}>
                  <span style={{ color: '#ffab00', fontWeight: 700 }}>▸ BEST FOR: </span>
                  <span style={{ color: '#556677' }}>{algo.bestFor}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid #1a2332',
            textAlign: 'center',
            fontSize: '0.55rem',
            color: '#2a3a4e',
            letterSpacing: '0.1em',
          }}
        >
          D3AS — DATA DRIVEN DISTRIBUTED AUTONOMOUS SYSTEMS · CLICK OUTSIDE TO CLOSE
        </div>
      </div>
    </div>
  );
}
