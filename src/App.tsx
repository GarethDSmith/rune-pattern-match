import { useEffect, useState } from "react"
import "./App.css"
import { GameState } from "./logic.ts"
import { Players } from "rune-games-sdk";

function PlayerGrid({ game, playerId, thisPlayer, score, players }:
  {game: GameState, playerId?: string, thisPlayer: boolean, score?: number, players: Players | undefined}) {
  const pattern: number[] = playerId ? game.playerPatterns[playerId] : game.targetPattern;

  let cardFooter = '';
  let playerName;
  if (playerId && players?.[playerId]) {
    playerName = <span className='playerName'>{players[playerId].displayName}</span>;
  }
  if (score !== undefined) {
    if (playerName) {
      cardFooter += ': ';
    }
    cardFooter += score;
  }
  let footerElement;
  if (cardFooter) {
    footerElement = <div className="cardFooter">{playerName}{cardFooter}</div>
  }

  return (
    <>
      <div className={'player' + (thisPlayer ? ' thisPlayer' : '')}>
        <div className='playingGrid'>
          {pattern.map((colour, index) => (
            <div
              className={"cell colour" + colour}
              key={index}
              onClick={() => {
                if (thisPlayer) {
                  Rune.actions.interactWithCell({ cellNum: index });
                }
              }}>
            </div>
          ))}
        </div>
        { footerElement }
      </div>
    </>
  );
}

function OtherPlayerGrids({ game, playerId, players }:
  { game: GameState, playerId: string | undefined, players: Players | undefined }) {
  // let toReturn = '';
  const otherPlayerIds: string[] = Object.keys(players ?? {}).filter((id) => id !== playerId);
  return (
    otherPlayerIds.map((playerId) => (
      <PlayerGrid
        key={playerId}
        game={game}
        playerId={playerId}
        thisPlayer={false}
        score={playerId ? game.scores[playerId] : 0}
        players={players} />
    ))
  );
}

function App() {
  const [game, setGame] = useState<GameState>();
  const [playerId, setPlayerId] = useState<string>();
  const [players, setPlayers] = useState<Players>();
  const gameName = 'Pattern match';
  useEffect(() => {
    Rune.initClient({
      onChange: ({ game, yourPlayerId, players }) => {
        setGame(game);
        setPlayerId(yourPlayerId);
        setPlayers(players);
      },
    })
  }, []);

  if (!game) {
    return <div>Loading...</div>
  }

  // Need to wait until people are ready to start
  if (!game.gameStarted) {
    let playersList;
    if (players) {
      playersList = Object.values(players).sort((a, b) => a.displayName < b.displayName ? -1 : 1).map((player) => (
        <div className="player" key={player.playerId}>
          <div className="avatar"><img src={player.avatarUrl} /></div>
          <div className="displayName">{player.displayName}</div>
          <div className={'status ' + (game.playerReady[player.playerId] ? 'ready' : '')}>✅</div>
        </div>
      ))
    }
    let button;
    // Countdown for 30 seconds for game to start.
    // If all players are ready start in 3 seconds
    // If all players are ready, show 'start now' button
    if (playerId && !game.playerReady[playerId ?? '']) {
      button = <div className="actions"><button onClick={() => Rune.actions.playerReady()}>I'm Ready!</button></div>
    // } else / * if all players are ready * /{
    //   button = <button onClick={() => Rune.actions.startGame()}>Start Now</button>;
    }
    return <div className="preGame overlay">
      <div className="dialog">
        <h1>{gameName}</h1>
        <div className="players">
          <span>There are currently {Object.keys(players ?? {}).length} players here.</span>
          <div className="playerList">
            {playersList}
          </div>
        </div>
        {button}
        Game starts in: {game.nextRoundStartSeconds}
      </div>
    </div>
  }

  let roundOverDialog;
  if (game.roundOver) {
    const winnerName = players?.[game.roundWinner ?? ''].displayName;
    roundOverDialog = (
      <div className="roundOver overlay">
        <div className="details dialog">
          <h1 className="title">Round over</h1>
          <div className="winner">{winnerName} won in {game.roundDuration} seconds</div>
          {/* <div className="winner">{winnerName} won in {game.playerMoves[game.roundWinner ?? '']} moves</div> */}
          {/* <div className="stats">All players made {game.totalMoves} moves in total</div> */}
          Next round starts in: {game.nextRoundStartSeconds}
        </div>
      </div>
    );
  }

  let playingArea;
  if (playerId) {
    playingArea = <>
      <PlayerGrid game={game} playerId={playerId} thisPlayer={true} score={playerId ? game.scores[playerId] : 0} players={players} />
      <div className="otherPlayersWrapper">
        <div className="otherPlayers">
          <OtherPlayerGrids game={game} playerId={playerId} players={players}/>
        </div>
      </div>
    </>;
  } else {
    // Spectator
    playingArea =
      <div className="spectator">
        <OtherPlayerGrids game={game} playerId={playerId} players={players}/>
      </div>;
  }

  return (
    <>
      <div className="header">
        <h1>{gameName}</h1>
        {/* <h2>A parsnip experience</h2> */}
      </div>
      <div className="gameArea">
        <div className="targetPattern">
          <PlayerGrid game={game} thisPlayer={false} players={players} />
        </div>
        <div className="playingAreaWrapper">
          <div className="playingArea">
            {playingArea}
          </div>
        </div>
      </div>
      {roundOverDialog}
    </>
  )
}

export default App;
