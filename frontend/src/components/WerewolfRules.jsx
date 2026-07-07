import React from 'react';

// How-to-play reference, openable any time during a Werewolf game. The phase the
// room is currently in is highlighted so players can see "we are here".
function WerewolfRules({ gameState, onClose }) {
  const phase = gameState?.phase;
  // Map the live phase to the flow step it belongs to.
  const activeStep =
    phase === 'NIGHT' || phase === 'NIGHT_WITCH' || phase === 'HUNTER_REVENGE' ? 'night'
    : phase === 'DAY' ? 'day'
    : phase === 'VOTING' ? 'vote'
    : null;

  const wins = [
    { icon: '🏘️', name: 'ชาวบ้าน', color: '#66fcf1', text: 'กำจัดหมาป่าให้หมดทุกตัว' },
    { icon: '🐺', name: 'หมาป่า', color: '#ff6b6b', text: 'ทำให้จำนวนหมาป่ามากกว่าหรือเท่ากับชาวบ้านที่เหลือ' },
    { icon: '🤡', name: 'คนบ้า', color: '#fcd34d', text: 'หลอกให้คนอื่นโหวตคุณออกตอนกลางวัน (ชนะทันที)' },
    { icon: '💘', name: 'คู่รัก', color: '#f472b6', text: 'คู่รักเหลือรอดเป็น 2 คนสุดท้ายพร้อมกัน' },
  ];

  const steps = [
    { key: 'night', icon: '🌙', title: 'กลางคืน',
      text: 'แต่ละบทบาททำหน้าที่ทีละคนตามลำดับ (คิวปิด → หมาป่า → ผู้หยั่งรู้ → หมอ → แม่มด) เฉพาะคนที่ถึงคิว คนอื่นหลับตารอ' },
    { key: 'day', icon: '☀️', title: 'กลางวัน',
      text: 'เปิดเผยว่าใครเสียชีวิตเมื่อคืน จากนั้นทุกคนพูดคุย ถกเถียง หาตัวผู้ต้องสงสัย' },
    { key: 'vote', icon: '⚖️', title: 'โหวต',
      text: 'ทุกคนที่ยังมีชีวิตโหวตคนที่จะประหาร คะแนนสูงสุดถูกกำจัด (ถ้าเสมอ = ไม่มีใครถูกกำจัด)' },
  ];

  const notes = [
    '🐺 หมาป่าคุยกันได้ในแชทหมาป่าตอนกลางคืน และต้องเลือกเหยื่อให้ตรงกันทั้งฝูง',
    '🔮 ผู้หยั่งรู้ตรวจบทบาทได้ 1 คนต่อคืน',
    '💉 หมอคุ้มครองได้ 1 คนต่อคืน (ห้ามคนเดิม 2 คืนติด)',
    '🧪 แม่มดมียาชุบชีวิตและยาพิษ อย่างละ 1 ครั้งทั้งเกม',
    '🏹 นายพรานตายเมื่อไร ยิงคนอื่นตายตามได้ 1 คน',
    '🐺 ลูกหมาป่าถ้าถูกฆ่า คืนถัดไปฝูงหมาป่าจะคร่าชีวิต 2 คน',
  ];

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem', color: 'var(--text-highlight)' }}>{title}</h3>
      {children}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{ maxWidth: '460px', width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>📖 กติกาการเล่น</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', width: 'auto', padding: '0 6px', margin: 0 }}>×</button>
        </div>

        <Section title="🎯 เงื่อนไขการชนะ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {wins.map(w => (
              <div key={w.name} style={{ display: 'flex', gap: '8px', fontSize: '0.88rem', lineHeight: 1.4 }}>
                <span style={{ flexShrink: 0 }}>{w.icon}</span>
                <span><strong style={{ color: w.color }}>{w.name}</strong> — {w.text}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="🔄 ลำดับการเล่นแต่ละรอบ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {steps.map((s, i) => {
              const active = s.key === activeStep;
              return (
                <div key={s.key} style={{
                  display: 'flex', gap: '10px', padding: '10px 12px', borderRadius: '10px',
                  background: active ? 'rgba(69,160,158,0.22)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${active ? 'var(--accent-color)' : 'transparent'}`,
                }}>
                  <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>
                      {i + 1}. {s.title}
                      {active && <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: 'var(--accent-color)' }}>● ตอนนี้</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#c8d2e8', marginTop: '2px', lineHeight: 1.45 }}>{s.text}</div>
                  </div>
                </div>
              );
            })}
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#8894b4', textAlign: 'center' }}>
              ↻ วนซ้ำจากกลางคืนใหม่ จนกว่าจะมีฝ่ายใดชนะ
            </p>
          </div>
        </Section>

        <Section title="✨ ความสามารถของบทบาท">
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {notes.map((n, i) => (
              <li key={i} style={{ fontSize: '0.83rem', color: '#c8d2e8', lineHeight: 1.45 }}>{n}</li>
            ))}
          </ul>
        </Section>

        <button onClick={onClose} style={{ marginTop: '0.5rem' }}>เข้าใจแล้ว</button>
      </div>
    </div>
  );
}

export default WerewolfRules;
