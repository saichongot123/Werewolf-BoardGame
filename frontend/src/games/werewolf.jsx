import React from 'react';
import Lobby from '../components/Lobby';
import RoleView from '../components/RoleView';
import EndGame from '../components/EndGame';
import WerewolfTable from './werewolfTable';

// Renders the correct Werewolf screen for the current phase.
// `ctx` is the bundle of state + handlers that App.jsx passes down — this keeps
// App game-agnostic: it only knows "render this game's view", not the phases.
export function renderWerewolfPhase(ctx) {
  const {
    gameState, currentPlayer, error,
    seerResult, nightResult, voteResult,
    onStartGame, onUpdateSettings, onKickPlayer,
    onNightAction, onWitchAction, onHunterAction,
    onVote, onStartVoting, onPlayAgain, onGameAction,
  } = ctx;

  switch (gameState.phase) {
    case 'LOBBY':
      return <Lobby
                gameState={gameState}
                currentPlayer={currentPlayer}
                onStartGame={onStartGame}
                onUpdateSettings={onUpdateSettings}
                onKickPlayer={onKickPlayer}
                onGameAction={onGameAction}
                error={error}
             />;
    case 'ROLE_VIEW':
      return <RoleView player={currentPlayer} players={gameState.players} />;
    // In-game phases share the immersive "village circle" table. It reuses the
    // phase components (NightPhase/WitchPhase/VotingPhase/HunterPhase) as its
    // bottom action dock, so all game logic still lives in those components.
    case 'NIGHT':
    case 'NIGHT_WITCH':
    case 'DAY':
    case 'VOTING':
    case 'HUNTER_REVENGE':
      return <WerewolfTable
                gameState={gameState}
                currentPlayer={currentPlayer}
                onNightAction={onNightAction}
                onWitchAction={onWitchAction}
                onVote={onVote}
                onHunterAction={onHunterAction}
                onStartVoting={onStartVoting}
                seerResult={seerResult}
                nightResult={nightResult}
                voteResult={voteResult}
             />;
    case 'END_GAME':
      return <EndGame
                gameState={gameState}
                currentPlayer={currentPlayer}
                onPlayAgain={onPlayAgain}
             />;
    default:
      return <div>Unknown Phase</div>;
  }
}
