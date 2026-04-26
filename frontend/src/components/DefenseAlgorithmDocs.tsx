'use client';

const CATEGORY_COLORS: Record<string, string> = {
  GEO: '#3a8aaa',
  DEPTH: '#7a6aaa',
  SCREEN: '#aa6a3a',
  'SAT-DEF': '#cc4444',
  TIMING: '#3aaa7a',
};

const DEFENSE_ALGORITHMS = [
  {
    id: 'perimeter_picket',
    num: '01',
    name: 'Perimeter Picket',
    category: 'GEO',
    tagline: '360° early-warning ring',
    description:
      'Radars distributed evenly on a circle at 80 mi from map center; each SAM placed 8 mi inward from its paired radar, facing the center. Drones are detected at the outer edge before they reach interior assets.',
    strength: 'Full 360° detection; drones caught far from high-value targets.',
    weakness: 'Isolated nodes — no mutual SAM support. One saturated node opens a corridor.',
    bestVs: 'Multi-Azimuth, Random Walk, Grid Sweep — wide-approach strategies.',
  },
  {
    id: 'corner_anchors',
    num: '02',
    name: 'Corner Anchors',
    category: 'GEO',
    tagline: 'Full map radar lock from 4 corners',
    description:
      'Four radars at map corners plus one central node. A 100 mi radar radius at each corner covers half the map; together the four produce 100% overlap across the entire 200×200 area with zero detection gaps.',
    strength: 'Complete map-wide detection guaranteed with the fewest emitters.',
    weakness: 'SAM coverage gaps in the map center; corner radars are isolated.',
    bestVs: 'Grid Sweep, Sector Claim, Spiral Outward — methodical full-map searches.',
  },
  {
    id: 'layered_rings',
    num: '03',
    name: 'Layered Rings',
    category: 'DEPTH',
    tagline: 'Defense in depth — two engagement layers',
    description:
      'Outer ring of radars at 75 mi radius provides long-range detection. Inner ring of radars and SAMs at 20–30 mi creates a second engagement layer. Drones that survive the outer SAMs face a second kill opportunity before reaching the center.',
    strength: 'Two sequential kill opportunities; leakers re-engaged by the inner layer.',
    weakness: 'Outer radars have no SAM protection; complex placement.',
    bestVs: 'Bait Ladder, Reload Trap — strategies relying on surviving the first SAM wave.',
  },
  {
    id: 'fortress_core',
    num: '04',
    name: 'Fortress Core',
    category: 'DEPTH',
    tagline: 'Concentrated mutual-support stronghold',
    description:
      'All radars clustered within 14 mi of map center. SAMs form a protective ring up to 10 mi outward from the cluster. Every SAM battery can be cued by every radar simultaneously, and multiple SAMs can engage a single drone.',
    strength: 'Maximum missile concentration; very hard to saturate; all assets mutually support.',
    weakness: 'Zero edge detection — drones approach unseen until ~100 mi out.',
    bestVs: 'Scout-Fix-Finish, Hotspot Reinforce — concentration tactics against a known center.',
  },
  {
    id: 'kill_channel',
    num: '05',
    name: 'Kill Channel',
    category: 'SCREEN',
    tagline: 'Axis gauntlet along the 45° threat bearing',
    description:
      'All radars and SAMs arranged in a dense column along the 45° NE axis (the primary threat bearing). SAM fire zones overlap at 25 mi intervals, so any drone flying that heading runs a gauntlet of 3–4 sequential kill zones.',
    strength: 'Near-certain kill probability on the primary axis; staggered SAM support.',
    weakness: 'Flanks (20°, 70°) completely uncovered — useless against multi-azimuth split.',
    bestVs: 'Saturation Fan, Hotspot Reinforce — mass attacks along a single bearing.',
  },
  {
    id: 'sam_forward_screen',
    num: '06',
    name: 'SAM Forward Screen',
    category: 'SCREEN',
    tagline: 'Sacrificial forward intercept line',
    description:
      'Forward radars and SAMs placed near the NE map boundary intercept drones at the operational area edge. Rear radars sit 50–60 mi deep, protected. Since drones have a hard 300 mi range budget, fighting through the screen meaningfully constrains where they can travel afterward.',
    strength: 'Rear radar positions deeply protected; drones arrive range-limited.',
    weakness: 'Forward SAMs lack rear-radar cuing fidelity; flanking routes bypass the screen.',
    bestVs: 'Reload Trap, Bait Ladder, Hotspot Reinforce — approach-convergence strategies.',
  },
  {
    id: 'magazine_wall',
    num: '07',
    name: 'Magazine Wall',
    category: 'SAT-DEF',
    tagline: 'Saturation counter — pack maximum missiles per radar',
    description:
      'Radars are clustered at 2–3 hub positions. All SAM launchers are concentrated around those hubs, packing 6–8+ batteries within 10 mi of each hub. A 10-drone swarm that triggers saturation finds 16+ missiles waiting — more than double the required capacity.',
    strength: 'Absorbs even large saturation swarms; missile surplus over any known swarm size.',
    weakness: 'Fewer detection nodes; radar loss blinds all paired SAMs in a hub.',
    bestVs: 'Saturation Fan, Bait Ladder, Reload Trap — magazine-exhaustion strategies.',
  },
  {
    id: 'dispersed_ambush',
    num: '08',
    name: 'Dispersed Ambush',
    category: 'SAT-DEF',
    tagline: 'Maximum-separation web — drain drone flight budget',
    description:
      'Radar-SAM pairs spread at maximum mutual distance across a uniform grid. Drones must fly far between targets, burning their 300 mi budget. Hotspot tactics destroy one node but cannot reach the next in time.',
    strength: 'Hard to sweep; drones exhaust range budget before reaching all assets.',
    weakness: 'No mutual SAM support — each node must defend itself alone.',
    bestVs: 'Hotspot Reinforce, Meta Selector — focus-fire strategies that hit one target at a time.',
  },
  {
    id: 'staggered_emission_web',
    num: '09',
    name: 'Staggered Emission Web',
    category: 'TIMING',
    tagline: 'Continuous detection — eliminates silent windows',
    description:
      'Radars distributed in a uniform grid with deliberately staggered power-on offsets: radar i activates at tick i × (30 / N). Each radar is individually silent 83% of the time, but together they maintain continuous map-wide coverage — closing the timing window that Bait Ladder and Reload Trap exploit.',
    strength: 'Near-continuous detection; eliminates system-wide dark windows.',
    weakness: 'Individual radars still vulnerable during their own 25-tick silent phase.',
    bestVs: 'Reload Trap, Bait Ladder — strategies that exploit radar emission timing gaps.',
  },
  {
    id: 'honeycomb_grid',
    num: '10',
    name: 'Honeycomb Grid',
    category: 'GEO',
    tagline: 'Optimal hexagonal area tiling',
    description:
      'Radars placed at the six vertices of a regular hexagon (radius 57 mi) centered on the map, then at the center and inner midpoints for higher counts. Hexagonal tiling minimises uncovered area — every map point falls within at least one 100 mi radar radius, and the center SAMs receive cuing from multiple surrounding radars simultaneously.',
    strength: 'No blind spots; uniform kill zone density; multi-radar cuing on every SAM battery.',
    weakness: 'Rigid geometry may cluster assets along hex seam corridors between cells.',
    bestVs: 'Grid Sweep, Multi-Azimuth, Random Walk — any approach from any direction.',
  },
];

interface Props {
  onClose: () => void;
}

export default function DefenseAlgorithmDocs({ onClose }: Props) {
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
          borderTop: '3px solid #ff1744',
          maxWidth: 860,
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
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: '#ff1744', marginBottom: '0.25rem' }}>
              D3AS DOCTRINE — ADVERSARY SIDE
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#c5cdd8', letterSpacing: '0.1em' }}>
              DEFENSE INITIALIZATION ALGORITHMS
            </div>
            <div style={{ fontSize: '0.55rem', color: '#445566', letterSpacing: '0.12em', marginTop: '0.2rem' }}>
              200×200 MI OPERATIONAL AREA · SAM + RADAR PLACEMENT
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

        {/* Category legend */}
        <div
          style={{
            padding: '0.5rem 1.5rem',
            borderBottom: '1px solid #0d1520',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.55rem' }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                background: color,
                borderRadius: 1,
              }} />
              <span style={{ color: '#556677', letterSpacing: '0.1em' }}>{cat}</span>
            </div>
          ))}
        </div>

        {/* Algorithm cards */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {DEFENSE_ALGORITHMS.map(algo => {
            const catColor = CATEGORY_COLORS[algo.category] ?? '#556677';
            return (
              <div
                key={algo.id}
                style={{
                  border: '1px solid #1a2332',
                  borderLeft: `3px solid ${catColor}`,
                  background: '#0a0e14',
                  padding: '0.75rem 1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.6rem', color: catColor, letterSpacing: '0.1em', fontWeight: 700 }}>
                      {algo.num}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c5cdd8', letterSpacing: '0.06em' }}>
                      {algo.name}
                    </span>
                    <span style={{
                      fontSize: '0.5rem',
                      color: catColor,
                      border: `1px solid ${catColor}`,
                      padding: '1px 5px',
                      letterSpacing: '0.1em',
                      opacity: 0.8,
                    }}>
                      {algo.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#445566', letterSpacing: '0.1em' }}>
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
                    <span style={{ color: '#ffab00', fontWeight: 700 }}>▸ BEST AGAINST: </span>
                    <span style={{ color: '#556677' }}>{algo.bestVs}</span>
                  </div>
                </div>
              </div>
            );
          })}
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
          D3AS — DEFENSE INITIALIZATION DOCTRINE · ADVERSARY PLACEMENT ONLY · CLICK OUTSIDE TO CLOSE
        </div>
      </div>
    </div>
  );
}
