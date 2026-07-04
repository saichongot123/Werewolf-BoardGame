import React from 'react';
import { getRole } from '../utils/roles';

// Slide-in list of every player: alive/dead status, and role only where the
// server already revealed it (yourself, werewolf teammates, or end game).
function PlayersPanel({ gameState, currentPlayer, isOpen, onClose }) {
  if (!isOpen || !gameState) return null;

  const players = gameState.players || [];
  const aliveCount = players.filter(p => p.isAlive).length;
  const isVoting = gameState.phase === 'VOTING';

  return (
    <div
      className="glass-panel"
      style={{
        position: 'fixed', bottom: '80px', left: '20px',
        width: '280px', maxHeight: '400px', padding: '12px',
        display: 'flex', flexDirection: 'column', zIndex: 998,
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-highlight)' }}>
          ผู้เล่น · เหลือ {aliveCount}/{players.length}
        </h3>
        <button onClick={onClose} style={{ background: 'transparent', padding: '0 5px', width: 'auto', border: 'none', color: '#fff', fontSize: '1.2rem', margin: 0 }}>×</button>
      </div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {players.map(p => {
          const role = p.role ? getRole(p.role) : null;
          return (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                opacity: p.isAlive ? 1 : 0.45,
              }}
            >
              <span style={{ fontSize: '1rem' }}>{p.isAlive ? '🟢' : '💀'}</span>
              <span style={{
                flex: 1, fontSize: '0.9rem', color: '#fff',
                textDecoration: p.isAlive ? 'none' : 'line-through',
              }}>
                {p.name}
                {p.id === currentPlayer?.id ? ' (คุณ)' : ''}
                {p.isHost ? ' 👑' : ''}
              </span>
              {isVoting && p.isAlive && p.hasVoted && (
                <span style={{ fontSize: '0.7rem', color: '#86efac' }}>โหวตแล้ว</span>
              )}
              {role && (
                <span style={{ fontSize: '0.75rem', color: role.color, fontWeight: 'bold' }}>{role.th}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayersPanel;
