const { WerewolfGame } = require('./werewolf');
const { SheriffGame } = require('./sheriff');

// Registry of every playable game. To add a new game:
//   1. create games/<name>.js exporting a class that extends BaseRoom
//   2. add an entry here
// The rest of the server stays game-agnostic and routes through this.
const GAMES = {
  werewolf: {
    label: 'มนุษย์หมาป่า',
    minPlayers: 4,
    maxPlayers: 10,
    create: (roomCode) => new WerewolfGame(roomCode),
  },
  sheriff: {
    label: 'ผู้ตรวจการแห่งนอตติงแฮม',
    minPlayers: 3,
    maxPlayers: 6,
    create: (roomCode) => new SheriffGame(roomCode),
  },
};

const DEFAULT_GAME = 'werewolf';

function createGame(gameType, roomCode) {
  const def = GAMES[gameType] || GAMES[DEFAULT_GAME];
  return def.create(roomCode);
}

function gameMeta(gameType) {
  return GAMES[gameType] || GAMES[DEFAULT_GAME];
}

// Public list for a "choose a game" screen later
function gameList() {
  return Object.entries(GAMES).map(([id, g]) => ({
    id, label: g.label, minPlayers: g.minPlayers, maxPlayers: g.maxPlayers,
  }));
}

module.exports = { GAMES, DEFAULT_GAME, createGame, gameMeta, gameList };
