import React from 'react';
import { getRole } from '../utils/roles';

// Public role lineup for the current game — counts per role, never who is what.
// Fed by gameState.roleSetup (a preview in the lobby, the real roster in-game).
function RoleSetupPanel({ gameState, isOpen, onClose }) {
  if (!isOpen || !gameState) return null;
  const setup = gameState.roleSetup || [];
  const total = setup.reduce((s, r) => s + r.count, 0);

  return (
    <div
      className="glass-panel"
      style={{
        position: 'fixed', bottom: '80px', left: '20px',
        width: '300px', maxHeight: '400px', padding: '12px',
        display: 'flex', flexDirection: 'column', zIndex: 998,
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-highlight)' }}>🎭 บทบาทในเกม ({total})</h3>
        <button onClick={onClose} style={{ background: 'transparent', padding: '0 5px', width: 'auto', border: 'none', color: '#fff', fontSize: '1.2rem', margin: 0 }}>×</button>
      </div>

      {gameState.phase === 'LOBBY' && (
        <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#8894b4' }}>
          * ตัวอย่างตามจำนวนคน/ตัวเลือกปัจจุบัน (สุ่มจริงตอนเริ่มเกม)
        </p>
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {setup.map(({ role, count }) => {
          const r = getRole(role);
          return (
            <div key={role} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '6px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
            }}>
              <img
                src={`/images/${role}.png`}
                alt={role}
                onError={(e) => { e.target.src = '/images/Werewolf.png'; }}
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
              <span style={{ flex: 1, color: r.color, fontWeight: 'bold', fontSize: '0.9rem' }}>{r.th}</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>×{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RoleSetupPanel;
