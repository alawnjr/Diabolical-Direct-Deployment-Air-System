import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="landing-bg flex flex-col items-center justify-center min-h-screen">
      <div className="landing-grid" />

      {/* Corner brackets */}
      <div style={{
        position: 'absolute', top: 24, left: 24, width: 48, height: 48,
        borderTop: '2px solid #ff1744', borderLeft: '2px solid #ff1744',
      }} />
      <div style={{
        position: 'absolute', top: 24, right: 24, width: 48, height: 48,
        borderTop: '2px solid #ff1744', borderRight: '2px solid #ff1744',
      }} />
      <div style={{
        position: 'absolute', bottom: 24, left: 24, width: 48, height: 48,
        borderBottom: '2px solid #ff1744', borderLeft: '2px solid #ff1744',
      }} />
      <div style={{
        position: 'absolute', bottom: 24, right: 24, width: 48, height: 48,
        borderBottom: '2px solid #ff1744', borderRight: '2px solid #ff1744',
      }} />

      {/* Classification banner */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        textAlign: 'center', padding: '6px',
        background: '#ff1744', color: '#fff',
        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.2em',
      }}>
        EXERCISE // UNCLASSIFIED // FOR TRAINING PURPOSES ONLY
      </div>

      {/* Main content */}
      <div style={{ textAlign: 'center', position: 'relative', animation: 'slide-up 0.6s ease-out' }}>
        {/* Logo/title block */}
        <div style={{
          display: 'inline-block',
          padding: '2px',
          background: 'linear-gradient(135deg, #ff1744, #d50000)',
          marginBottom: '2rem',
        }}>
          <div style={{ background: '#0a0e14', padding: '1.5rem 3rem' }}>
            <div style={{
              fontSize: '5rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ff1744, #ff6e40)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              D³AS
            </div>
          </div>
        </div>

        <div style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.28em',
          textTransform: 'uppercase' as const,
          color: '#c5cdd8',
          marginBottom: '0.5rem',
        }}>
          Diabolical Direct Deployment Air System
        </div>

        <div style={{
          fontSize: '0.6rem',
          letterSpacing: '0.18em',
          color: '#556677',
          marginBottom: '0.4rem',
        }}>
          SEAD / DEAD Wargaming Simulator
        </div>

        <div style={{
          fontSize: '0.55rem',
          letterSpacing: '0.16em',
          color: '#ff1744',
          marginBottom: '3rem',
        }}>
          SCSP HACKATHON 2026 · WARGAMING TRACK
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          gap: '2rem',
          justifyContent: 'center',
          marginBottom: '3rem',
          padding: '1rem 2rem',
          border: '1px solid #1a2332',
          background: '#0d1420',
        }}>
          {[
            { label: 'Drone Types', value: '2' },
            { label: 'Enemy Systems', value: '3' },
            { label: 'Mission Ticks', value: '60' },
            { label: 'Map Size', value: '200 NM' },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#00e5ff', lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: '#556677', marginTop: '0.2rem' }}>
                {label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link href="/game" style={{ textDecoration: 'none' }}>
          <button
            className="btn-tac btn-primary"
            style={{
              fontSize: '0.85rem',
              padding: '0.9rem 3rem',
              letterSpacing: '0.22em',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            ▶ START MISSION
          </button>
        </Link>

        <div style={{
          marginTop: '1rem',
          fontSize: '0.55rem',
          color: '#556677',
          letterSpacing: '0.1em',
        }}>
          BACKEND AUTONOMOUS · STANDALONE MODE AVAILABLE
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '8px 24px',
        borderTop: '1px solid #1a2332',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.55rem',
        color: '#556677',
        letterSpacing: '0.1em',
      }}>
        <span>SYSTEM: D³AS v1.0</span>
        <span>STATUS: NOMINAL</span>
        <span>CLASSIFICATION: EXERCISE</span>
      </div>
    </main>
  );
}
