# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Real-time multiplayer Werewolf (Mafia) party game. A Thai-language web app with a
Node/Socket.IO backend holding all game state and a React/Vite frontend that is a thin,
stateless renderer of server-pushed state. There are two independent npm projects:
`backend/` and `frontend/`.

## Commands

Backend (`backend/`):
- `npm install` then `npm start` — runs `node server.js` on port 3001 (or `$PORT`). No build step, no watch/reload, no tests configured.

Frontend (`frontend/`):
- `npm run dev` — Vite dev server (proxies nothing; connects directly to the backend via socket)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built bundle
- `npm run lint` — Oxlint (config in `.oxlintrc.json`); this is the only lint/test tooling in the repo

The frontend chooses the backend URL from `VITE_SERVER_URL` (defaults to `http://localhost:3001`, see `frontend/src/App.jsx`). Run both projects in separate terminals during development.

## Architecture

**Server is authoritative.** All game logic and state live in `backend/gameLogic.js`
(`GameRoom` class). `backend/server.js` is purely the Socket.IO transport layer: it owns
the `rooms` Map (`roomCode -> GameRoom`, in-memory only — restarting the server loses all
games) and per-room countdown timers (`roomTimers`), and translates socket events into
`GameRoom` method calls. The client never computes game outcomes; it emits intent and
re-renders whatever state the server pushes back.

**State fan-out is per-player and role-aware.** `GameRoom.getState(playerId)` returns a
*redacted* view: a player sees only their own role (werewolves also see each other),
and chat messages are filtered by channel (`GLOBAL` / `WEREWOLF` / `DEAD`) against the
requester. LittleGirl can peek at the werewolf channel but sees the sender anonymized.
Because of this, the server almost never broadcasts one shared state — it calls
`broadcastGameState(room, io)`, which loops players and emits an individually-computed
`game_state_update` to each socket. When adding state, decide explicitly what each role
may see and put that logic in `getState`, not on the client.

**The phase state machine** (`room.phase`) drives everything on both ends. Phases:
`LOBBY → ROLE_VIEW → NIGHT → (NIGHT_WITCH) → DAY → VOTING → NIGHT …`, plus interrupts
`HUNTER_REVENGE` and terminal `END_GAME`. The frontend `App.jsx` `renderPhase()` switch
maps each phase to a component (`Lobby`, `RoleView`, `NightPhase`, `WitchPhase`,
`DayPhase`, `VotingPhase`, `HunterPhase`, `EndGame`); `ChatBox` renders on top of all
phases. Adding a phase means updating both the transition logic in `gameLogic.js`/`server.js`
and this switch.

**Phase transitions are resolved in two ways** and both must stay in sync:
1. *All players acted* — event handlers call `room.checkNightEnd()` / `checkVotingEnd()` and, if true, resolve immediately.
2. *Timer expiry* — `startRoomTimer` in `server.js` force-resolves the same way when the countdown hits zero.
`processPhaseTransition(room, io)` is the single funnel that fires after any resolution:
it checks win conditions, emits `night_result`, starts the next timer, and (for `DAY`)
uses a 15s `setTimeout` before auto-advancing to `VOTING`. Keep these paths consistent —
a change to how a phase resolves usually needs mirroring in both the "all acted" branch
and the timer branch.

**The night is a sequential step queue**, not simultaneous. `beginNight()` builds
`nightQueue` in fixed order (Cupid → Werewolf → Seer → Doctor → Witch, skipping roles that
are absent/dead/irrelevant), then `startNightStep()` activates one role at a time via
`currentNightRole`. Only that role's players may act (`handleNightAction` guards on
`currentNightRole`); everyone else sees a "X is acting…" waiting screen. The server advances
when `checkStepEnd()` is true (all of the current role's actors submitted) or the step timer
expires (`advanceNightStep`). The Witch step is special: it precomputes the werewolf victim
(after the Doctor save) into `pendingWitchKill` so the Witch sees who's about to die, and it
runs under `phase === 'NIGHT_WITCH'` (rendered by `WitchPhase`). When the queue is exhausted,
`finalizeNight()` assigns lovers, applies the werewolf kill (unless healed) and witch poison,
then moves to `DAY`. `beginNight()` is the single entry point — call it (never bare
`setPhase('NIGHT')`) from every night transition: after ROLE_VIEW, after voting, and when a
Hunter's revenge returns to night. Server helpers `continueNight()` (run next step vs. finish)
and `startNextNightOrEnd()` (win-check then begin next night) funnel this.

`killPlayer(id, deathPhase)` centralizes death side effects: Fool win-on-lynch, Hunter
revenge (sets `HUNTER_REVENGE` + `pendingHunter`), and Lovers suicide (recursive via
`this.lovers`). Route all deaths through `killPlayer` so these triggers fire.

**Optional roles** are toggled by host settings (`enableFool/Hunter/Witch/Cupid/LittleGirl`)
and injected during `assignRoles()`. Werewolf count scales as `floor(numPlayers / 3)`,
minimum 4 players to start. Win conditions (`checkWinCondition`) include the special
`FOOL` and `LOVERS` victories alongside `WEREWOLVES`/`VILLAGERS`.

**Reconnection:** the client persists `playerId`/`roomCode` in `sessionStorage` and emits
`reconnect_player` on load. On `disconnect` the server keeps the player in the room
(nulling `socketId`) unless still in `LOBBY`, so a refresh rejoins an in-progress game.

## Conventions & gotchas

- **All user-facing strings are Thai.** Match this when adding UI text or chat/system messages.
- Role identifiers are English PascalCase (`Werewolf`, `Seer`, `LittleGirl`, …) used as keys everywhere, including image lookups `/images/{role}.png` in `frontend/public/images/`.
- The client emits a `start_voting` event that the server does **not** handle; voting is instead entered automatically via the `DAY` timeout in `processPhaseTransition`.
- Both socket CORS and Express CORS are wide open (`origin: '*'`) — intended for LAN/demo play.
