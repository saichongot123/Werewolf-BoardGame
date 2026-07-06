// Catalog of games shown on the selection screen.
// `id` must match a game registered in the backend (backend/games/index.js)
// and a renderer in games/index.js.
// status: 'available' = playable now, 'soon' = shown but disabled.
export const GAMES = [
  {
    id: 'werewolf',
    label: 'มนุษย์หมาป่า',
    emoji: '🐺',
    players: '4–10 คน',
    time: '15–30 นาที',
    desc: 'เกมไหวพริบและการหลอกลวง — ชาวบ้านต้องจับหมาป่าที่ซ่อนตัวให้เจอ ก่อนจะถูกกินจนหมดหมู่บ้าน',
    accent: '#ff6b6b',
    status: 'available',
  },
  {
    id: 'sheriff',
    label: 'ผู้ตรวจการแห่งนอตติงแฮม',
    emoji: '👑',
    players: '3–6 คน',
    time: '45–60 นาที',
    desc: 'เกมบลัฟและการต่อรอง — ลักลอบสินค้าผิดกฎหมายผ่านด่านตรวจ หรือรับบทนายอำเภอที่ต้องจับให้ได้คาหนังคาเขา',
    accent: '#d4af37',
    status: 'available',
  },
];
