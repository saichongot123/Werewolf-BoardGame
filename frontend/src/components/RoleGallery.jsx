import React from 'react';

function RoleGallery({ onBack }) {
  const roles = [
    {
      name: 'Werewolf',
      description: 'หมาป่า: คุณจะตื่นขึ้นมาในตอนกลางคืนเพื่อกำจัดชาวบ้าน จงทำงานร่วมกับฝูงของคุณเพื่อเอาชีวิตรอด',
      alignment: 'Bad',
      color: '#ff4b4b'
    },
    {
      name: 'Seer',
      description: 'ผู้หยั่งรู้: คุณจะตื่นขึ้นมาในตอนกลางคืนเพื่อตรวจสอบบทบาทที่แท้จริงของผู้เล่น 1 คน',
      alignment: 'Good',
      color: '#86efac'
    },
    {
      name: 'Doctor',
      description: 'หมอ: คุณจะตื่นขึ้นมาในตอนกลางคืนเพื่อปกป้องผู้เล่น 1 คนจากการถูกกำจัด',
      alignment: 'Good',
      color: '#86efac'
    },
    {
      name: 'Villager',
      description: 'ชาวบ้าน: คุณไม่มีความสามารถพิเศษใดๆ จงจับผิดและตามหาหมาป่าเพื่อโหวตพวกเขาออกในตอนกลางวัน',
      alignment: 'Good',
      color: '#86efac'
    },
    {
      name: 'Fool',
      description: 'คนบ้า: คุณไม่มีเพื่อน คุณจะชนะก็ต่อเมื่อถูกโหวตออกในตอนกลางวัน! จงทำตัวให้มีพิรุธเข้าไว้',
      alignment: 'Neutral',
      color: '#fcd34d'
    },
    {
      name: 'Hunter',
      description: 'นายพราน: หากคุณถูกฆ่าตาย (ไม่ว่าจะตอนกลางคืนหรือจากการโหวต) คุณสามารถเลือกยิงปืนใส่ผู้เล่นคนอื่นให้ตายตามไปได้ 1 คนก่อนที่คุณจะตาย',
      alignment: 'Good',
      color: '#d8b4fe'
    },
    {
      name: 'Witch',
      description: 'แม่มด: มีขวดยาวิเศษ 2 ขวด (ใช้ได้แค่อย่างละครั้งในเกม) ยาชุบชีวิต 1 ขวดสำหรับชุบคนที่โดนหมาป่าฆ่า และ ยาพิษ 1 ขวดสำหรับสาดใส่ใครก็ได้ให้ตายในตอนกลางคืน',
      alignment: 'Good',
      color: '#4ade80'
    },
    {
      name: 'Cupid',
      description: 'คิวปิด: ในคืนแรก คุณจะได้เลือกผู้เล่น 2 คนให้ตกหลุมรักกัน หากใครคนใดคนหนึ่งตาย อีกคนจะตรอมใจตายตามไปด้วย! คู่รักจะชนะเมื่อเหลือรอดเป็นสองคนสุดท้าย',
      alignment: 'Good',
      color: '#f472b6'
    },
    {
      name: 'WolfCub',
      description: 'ลูกหมาป่า: เป็นหมาป่าตัวหนึ่ง ล่าเหยื่อกับฝูงตามปกติ แต่ถ้าลูกหมาป่าถูกฆ่า ฝูงจะแค้น — คืนถัดไปหมาป่าจะคร่าชีวิตได้ 2 คน',
      alignment: 'Bad',
      color: '#ff7b4b'
    }
  ];

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', width: '100%', padding: '2rem' }}>
      <button className="secondary" onClick={onBack} style={{ marginBottom: '1.5rem', width: 'auto', padding: '0.5rem 1rem' }}>
        ← Back
      </button>
      
      <h2 style={{ textAlign: 'center', marginBottom: '2rem', letterSpacing: '2px' }}>ROLE GALLERY</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '1rem' }}>
        {roles.map((role) => (
          <div key={role.name} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px' }}>
            <img
              src={`/images/${role.name}.png`}
              alt={role.name}
              onError={(e) => { e.target.src = '/images/Werewolf.png'; }}
              style={{ width: '100px', height: '100px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', flexShrink: 0 }}
            />
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: role.color }}>{role.name}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4', color: '#ccc' }}>{role.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoleGallery;
