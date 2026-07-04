import React, { useRef, useEffect } from 'react';

// Chronological public event history: night deaths, vote outcomes (with the
// full who-voted-whom breakdown). Newest entries at the bottom.
function GameLog({ gameState, isOpen, onClose }) {
  const endRef = useRef(null);
  const log = gameState?.gameLog || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length, isOpen]);

  if (!isOpen || !gameState) return null;

  return (
    <div
      className="glass-panel"
      style={{
        position: 'fixed', bottom: '80px', left: '20px',
        width: '300px', height: '400px', padding: '12px',
        display: 'flex', flexDirection: 'column', zIndex: 998,
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-highlight)' }}>📜 บันทึกเหตุการณ์</h3>
        <button onClick={onClose} style={{ background: 'transparent', padding: '0 5px', width: 'auto', border: 'none', color: '#fff', fontSize: '1.2rem', margin: 0 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {log.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', marginTop: 'auto', marginBottom: 'auto' }}>
            ยังไม่มีเหตุการณ์
          </div>
        ) : (
          log.map(entry => (
            <div
              key={entry.id}
              style={{
                fontSize: '0.85rem', color: '#ddd', lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                padding: '8px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {entry.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export default GameLog;
