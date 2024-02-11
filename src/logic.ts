import type { RuneClient } from "rune-games-sdk/multiplayer"

const FORCE_START_MILLIS = 30_000;
const ALL_READY_START_MILLIS = 3_000;
const ROUND_START_MILLIS = 5_000;

type GameActions = {
  startGame: () => void;
  increment: (params: { amount: number }) => void;
  interactWithCell: (params: { cellNum: number }) => void;
  playerReady: () => void;
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

const colours = 3;
const gridSize = 9;
const winningScore = 5;

export function getCount(game: GameState) {
  return game.totalMoves;
}

function getColour(): number {
  return Math.floor(Math.min(Math.random() * colours, colours - 1));
}

function generatePattern(): number[] {
  const grid: number[] = [];
  for (let i = 0; i < gridSize; i++) {
    grid[i] = getColour();
  }
  return grid;
}

function initialisePlayerPattern(): number[] {
  const grid: number[] = [];
  for (let i = 0; i < gridSize; i++) {
    grid[i] = 0;
  }
  return grid;
}

function patternsMatch(patternA: number[], patternB: number[]): boolean {
  for (let i = 0; i < gridSize; i++) {
    if (patternA[i] !== patternB[i]) {
      return false;
    }
  }
  return true;
}

function roundReset(game: GameState, allPlayerIds: string[]): void {
  for (const playerId of allPlayerIds) {
    game.playerPatterns[playerId] = initialisePlayerPattern();
    game.playerMoves[playerId] = 0;
  }
  game.totalMoves = 0;
  game.targetPattern = generatePattern();
  game.roundOver = false;
}

export interface GameState {
  roundStartMillis: number,
  gameStarted: boolean;
  totalMoves: number,
  playerMoves: Record<string, number>,
  targetPattern: number[],
  // PlayerId -> wins
  scores: Record<string, number>,
  // PlayerId -> current grid
  playerPatterns: Record<string, number[]>,
  playerReady: Record<string, boolean>,
  roundOver: boolean;
  roundEndTime: number | undefined;
  roundWinner: string | undefined;
  roundDuration: number,
  nextRoundStartSeconds: number;
}

Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 4,
  setup: (allPlayerIds): GameState => {
    const scores: Record<string, number> = {};
    const playerPatterns: Record<string, number[]> = {};
    for (const playerId of allPlayerIds) {
      scores[playerId] = 0;
      playerPatterns[playerId] = initialisePlayerPattern();
    }
    return {
      roundStartMillis: Rune.gameTime() + FORCE_START_MILLIS,
      gameStarted: false,
      totalMoves: 0,
      targetPattern: generatePattern(),
      scores,
      playerPatterns,
      playerMoves: {},
      playerReady: {},
      roundOver: false,
      roundEndTime: 0,
      roundWinner: undefined,
      roundDuration: 0,
      nextRoundStartSeconds: FORCE_START_MILLIS / 1000,
    }
  },
  actions: {
    startGame: (state, { game }) => {
      game.gameStarted = true;
    },
    increment: ({ amount }, { game }) => {
      game.totalMoves += amount
    },
    interactWithCell: ({ cellNum }, { game, playerId }) => {
      const playerPattern: number[] = game.playerPatterns[playerId];
      if (!playerPattern) {
        return;
      }
      let newValue: number = (playerPattern[cellNum] ?? 0) + 1;
      if (newValue >= colours) {
        newValue = 0;
      }
      playerPattern[cellNum] = newValue;
      ++game.totalMoves;
      game.playerMoves[playerId] = (game.playerMoves[playerId] ?? 0) + 1;
      if (patternsMatch(playerPattern, game.targetPattern)) {
        game.scores[playerId] = (game.scores[playerId] ?? 0) + 1;
        // display a result, then reset
        game.roundEndTime = Rune.gameTime();
        // This would display to 2dp if gameTime returned a more precise number. Tied to updatesPerSecond
        game.roundDuration = Math.floor((game.roundEndTime - game.roundStartMillis) / 10) / 100;
        game.roundOver = true;
        game.roundWinner = playerId;
        if (game.scores[playerId] >= winningScore) {
          // Game over
          Rune.gameOver({players: game.scores})
        } else {
          game.roundStartMillis = Rune.gameTime() + ROUND_START_MILLIS;
          game.nextRoundStartSeconds = ROUND_START_MILLIS / 1000;
        }
      }
    },
    playerReady: (params, {game, playerId, allPlayerIds}) => {
      game.playerReady[playerId] = true;
      for (const playerId of allPlayerIds) {
        if (!game.playerReady[playerId]) {
          return;
        }
      }
      // All players are now ready - reduce the timer
      if (!game.gameStarted && (Rune.gameTime() + ALL_READY_START_MILLIS < game.roundStartMillis)) {
        game.roundStartMillis = Rune.gameTime() + ALL_READY_START_MILLIS;
        game.nextRoundStartSeconds = ALL_READY_START_MILLIS / 1000;
      }
    },
  },
  events: {
    playerJoined: (playerId, { game }) => {
      game.scores[playerId] = 0;
      game.playerPatterns[playerId] = initialisePlayerPattern();
      game.playerMoves[playerId] = 0;
    },
    playerLeft: (playerId, { game }) => {
      delete game.scores[playerId];
      delete game.playerPatterns[playerId];
      delete game.playerMoves[playerId];
    },
  },
  update: ({ game, allPlayerIds }) => {
    const now = Rune.gameTime();
    const millisToNextRound = game.roundStartMillis - now;
    if ((!game.gameStarted || game.roundOver) && millisToNextRound <= 0) {
      roundReset(game, allPlayerIds);
      game.gameStarted = true;
    }
    if (millisToNextRound > 0) {
      game.nextRoundStartSeconds = Math.ceil(millisToNextRound / 1000);
    } else if (game.nextRoundStartSeconds !== 0) {
      game.nextRoundStartSeconds = 0;
    }
  },
})
