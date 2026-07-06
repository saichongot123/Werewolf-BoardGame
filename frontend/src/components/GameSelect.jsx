import React from 'react';
import { GAMES } from '../games';

// Game picker shown after the player enters a name and taps "create room".
// Selecting an available game creates a room of that gameType.
function GameSelect({ playerName, onSelect, onBack }) {
  return (
    <div className="glass-panel">
      <button
        className="secondary"
        onClick={onBack}
        style={{ width: 'auto', padding: '0.5rem 1rem', marginBottom: '1.5rem' }}
      >
        ← กลับ
      </button>

      <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>เลือกเกม</h2>
      <p className="status-message">
        สวัสดี <strong style={{ color: 'var(--text-highlight)' }}>{playerName}</strong> — อยากเล่นเกมไหนดี?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {GAMES.map((g) => {
          const soon = g.status !== 'available';
          return (
            <div
              key={g.id}
              onClick={() => !soon && onSelect(g.id)}
              role="button"
              tabIndex={soon ? -1 : 0}
              onKeyDown={(e) => !soon && e.key === 'Enter' && onSelect(g.id)}
              style={{
                cursor: soon ? 'not-allowed' : 'pointer',
                opacity: soon ? 0.5 : 1,
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                padding: '1rem 1.2rem',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${soon ? 'rgba(255,255,255,0.1)' : g.accent}`,
                transition: 'transform 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!soon) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { if (!soon) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              <div style={{ fontSize: '2.6rem', lineHeight: 1 }}>{g.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.15rem', color: soon ? '#aaa' : g.accent }}>{g.label}</strong>
                  {soon && (
                    <span style={{ fontSize: '0.7rem', color: '#0b0c10', background: '#8b93a7', padding: '1px 8px', borderRadius: '20px', fontWeight: 700 }}>
                      เร็วๆ นี้
                    </span>
                  )}
                </div>
                {g.players && (
                  <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.2rem' }}>
                    👥 {g.players} &nbsp;·&nbsp; ⏱️ {g.time}
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '0.4rem', lineHeight: 1.5 }}>{g.desc}</p>
              </div>
              {!soon && <span style={{ color: g.accent, fontSize: '1.6rem', flexShrink: 0 }}>→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GameSelect;
