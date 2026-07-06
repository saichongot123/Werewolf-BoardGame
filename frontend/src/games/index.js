import { renderWerewolfPhase } from './werewolf';
import { renderSheriffPhase } from './sheriff';

// The catalog (metadata for the picker) lives alongside the renderers.
export { GAMES } from './catalog';

// Maps gameType → a function that renders that game's in-room screens.
// To add a game's UI: create games/<name>.jsx exporting a render function,
// then register it here. App.jsx picks the renderer by gameState.gameType.
export const GAME_RENDERERS = {
  werewolf: renderWerewolfPhase,
  sheriff: renderSheriffPhase,
};

export function getGameRenderer(gameType) {
  return GAME_RENDERERS[gameType] || renderWerewolfPhase;
}
