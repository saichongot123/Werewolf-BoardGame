import React from 'react';
import Lobby from '../components/Lobby';
import RoleView from '../components/RoleView';
import NightPhase from '../components/NightPhase';
import WitchPhase from '../components/WitchPhase';
import DayPhase from '../components/DayPhase';
import VotingPhase from '../components/VotingPhase';
import HunterPhase from '../components/HunterPhase';
import EndGame from '../components/EndGame';

// Renders the correct Werewolf screen for the current phase.
// `ctx` is the bundle of state + handlers that App.jsx passes down — this keeps
// App game-agnostic: it only knows "render this game's view", not the phases.
export function renderWerewolfPhase(ctx) {
  const {
    gameState, currentPlayer, error,
    seerResult, nightResult, voteResult,
    onStartGame, onUpdateSettings, onKickPlayer,
    onNightAction, onWitchAction, onHunterAction,
    onVote, onStartVoting, onPlayAgain,
  } = ctx;

  switch (gameState.phase) {
    case 'LOBBY':
      return <Lobby
                gameState={gameState}
                currentPlayer={currentPlayer}
                onStartGame={onStartGame}
                onUpdateSettings={onUpdateSettings}
                onKickPlayer={onKickPlayer}
                error={error}
             />;
    case 'ROLE_VIEW':
      return <RoleView player={currentPlayer} />;
    case 'NIGHT':
      return <NightPhase
                gameState={gameState}
                currentPlayer={currentPlayer}
                onAction={onNightAction}
                seerResult={seerResult}
             />;
    case 'NIGHT_WITCH':
      return <WitchPhase
                gameState={gameState}
                currentPlayer={currentPlayer}
                onWitchAction={onWitchAction}
             />;
    case 'DAY':
      return <DayPhase
                gameState={gameState}
                currentPlayer={currentPlayer}
                nightResult={nightResult}
                onStartVoting={onStartVoting}
                voteResult={voteResult}
             />;
    case 'VOTING':
      return <VotingPhase
                gameState={gameState}
                currentPlayer={currentPlayer}
                onVote={onVote}
             />;
    case 'HUNTER_REVENGE':
      return <HunterPhase
                gameState={gameState}
                currentPlayer={currentPlayer}
                onHunterAction={onHunterAction}
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
