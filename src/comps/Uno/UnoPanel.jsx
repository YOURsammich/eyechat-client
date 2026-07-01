// ─────────────────────────────────────────────────────────────────────────────
// UNO — client floating panel (TEMPORARY PORT).
//
// Ported from an old plugin-maker codebase. The old `tools`/`eventLibrary`/
// `PanelVieww`/`store.get('nick')`/`channelOcto` globals don't exist here, so:
//   - `tools` is a shim over this project's `socket` (prefixes every event
//     name with `uno:` so the ported logic can use bare names).
//   - the floating draggable panel (`PanelVieww`) is rebuilt as <UnoPanel>.
//   - the current nick comes in as a prop.
//
// Self-contained: to remove UNO, delete this file + the /uno command in
// handleInput.js + the mount in ChatWindow.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from 'react';
import { useRef, useEffect } from 'react';

const COLORS = {
  red: '#F44336',
  green: '#4CAF50',
  blue: '#2196f3',
  yellow: '#ffeb3b'
};

const IMAGE_URL = {
  0: '/images/pluginassets/uno/0.png',
  1: '/images/pluginassets/uno/1.png',
  2: '/images/pluginassets/uno/2.png',
  3: '/images/pluginassets/uno/3.png',
  4: '/images/pluginassets/uno/4.png',
  5: '/images/pluginassets/uno/5.png',
  6: '/images/pluginassets/uno/6.png',
  7: '/images/pluginassets/uno/7.png',
  8: '/images/pluginassets/uno/8.png',
  9: '/images/pluginassets/uno/9.png',
  'Draw Two': '/images/pluginassets/uno/draw2.png',
  'Reverse': '/images/pluginassets/uno/reverse.png',
  'Skip': '/images/pluginassets/uno/skip.png',
  'Wild': '/images/pluginassets/uno/wild.png',
  'Wild Draw Four': '/images/pluginassets/uno/draw4.png'
};

// short text labels shown if the card image is missing
const LABELS = {
  'Draw Two': '+2',
  'Reverse': '⟲',
  'Skip': '⊘',
  'Wild': 'W',
  'Wild Draw Four': 'W+4'
};

const cardImgStyle = { height: '64px', position: 'relative', left: '-2px', top: '-2px' };

// A single card face: image with graceful text fallback on load error.
function CardFace({ cardName }) {
  const [failed, setFailed] = React.useState(false);
  if (failed || IMAGE_URL[cardName] === undefined) {
    return (
      <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#000', textAlign: 'center', width: '100%' }}>
        {LABELS[cardName] ?? cardName}
      </span>
    );
  }
  return (
    <img
      style={cardImgStyle}
      src={IMAGE_URL[cardName]}
      alt={String(cardName)}
      onError={() => setFailed(true)}
    />
  );
}

const css = {
  playingControls: { flexDirection: 'column', display: 'flex', alignItems: 'center', width: '100%' },
  unoControls: { marginTop: '10px', display: 'flex', alignItems: 'center', gap: '15px' },
  currentCardViewEl: {
    margin: '5px', height: '60px', width: '38px', color: 'black', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
  },
  yourHandView: {
    display: 'flex', flexWrap: 'wrap', border: '1px solid rgb(51, 153, 255)', width: '100%', marginTop: '10px'
  },
  colorPickerCon: { display: 'flex', backgroundColor: '#111', padding: '10px', zIndex: '10' }
};

function renderCard(cardName, color, keyId, callback) {
  return (
    <div
      key={keyId}
      style={{ ...css.currentCardViewEl, backgroundColor: COLORS[color] || '#000' }}
      onClick={callback || null}
    >
      <CardFace cardName={cardName} />
    </div>
  );
}

// ─── UNOGame ─────────────────────────────────────────────────────────────────

class UNOGame extends React.Component {
  constructor() {
    super();
    this.state = { colorPicker: false };
  }

  playCard(card, index) {
    if (card.cardName === 'Wild' || card.cardName === 'Wild Draw Four') {
      if (this.state.colorPicker === false) {
        this.setState({ colorPicker: index });
      }
    } else {
      this.setState({ colorPicker: false });
      this.props.tools.emit('playCard', { index });
    }
  }

  renderGame() {
    const currCard = this.props.card;
    if (!currCard) return <div>Waiting for cards...</div>;
    const myTurn = this.props.turn == this.props.myNick;
    const hand = this.props.hand || [];

    return (
      <div className="playingControls" style={css.playingControls}>
        <div className="unoControls" style={css.unoControls}>
          <button
            className="drawUno stdBtn smallBtn"
            style={{ backgroundColor: myTurn ? '' : '#333' }}
            onClick={() => this.props.tools.emit('drawCard')}
          >draw{this.props.drawSize ? ' ' + this.props.drawSize : ''}</button>

          <div className="currentCardView">
            {renderCard(currCard.cardName, currCard.color, 'currCard')}
          </div>

          <button
            className="passUno stdBtn smallBtn"
            style={{ backgroundColor: (myTurn && this.props.drew) ? '' : '#333' }}
            onClick={() => this.props.tools.emit('passTurn')}
          >pass</button>
        </div>

        {this.state.colorPicker !== false ? (
          <div style={css.colorPickerCon}>
            {Object.entries(COLORS).map(([name, hex]) => (
              <div
                key={name}
                style={{ backgroundColor: hex, width: '25px', height: '25px', cursor: 'pointer' }}
                onClick={() => {
                  this.setState({ colorPicker: false });
                  this.props.tools.emit('playCard', { index: this.state.colorPicker, color: name });
                }}
              ></div>
            ))}
          </div>
        ) : null}

        <div style={css.yourHandView}>
          {hand.map((a, index) => {
            const count = hand.reduce((acc, curr) => {
              if (curr.cardName == a.cardName && curr.color == a.color) acc++;
              return acc;
            }, 0);
            const keyId = a.cardName + a.color + (count > 1 ? index : 0);
            return renderCard(a.cardName, a.color, keyId, () => this.playCard(a, index));
          })}
        </div>
      </div>
    );
  }

  render() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="sessionName" style={{ marginBottom: '10px', fontStyle: 'italic', fontSize: '20px' }}>
          {this.props.currSession.sessionName}
        </div>

        <div className="otherPlayersView" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {this.props.players.map((nick) => {
            const cards = this.props.handLength ? this.props.handLength[nick] : 5;
            return (
              <div key={nick + cards} style={{
                backgroundColor: nick == this.props.turn ? '#39f' : '',
                padding: '3px', borderRadius: '5px'
              }}>
                <div className="nick">{nick}</div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>{cards} card(s)</div>
              </div>
            );
          })}
        </div>

        {this.props.currSession.watching ? (
          <div className="spectating">
            {this.props.card ? (
              <div className="currentCardView" style={{ display: 'flex', justifyContent: 'center' }}>
                {renderCard(this.props.card.cardName, this.props.card.color, 'currCard')}
              </div>
            ) : 'Please wait for current card to load.'}
            You are spectating.
          </div>
        ) : this.renderGame()}
      </div>
    );
  }
}

// ─── UNOWaitLobby ────────────────────────────────────────────────────────────

class UNOWaitLobby extends React.Component {
  render() {
    const { players, currSession, myNick, tools } = this.props;
    const isHost = players[0] === myNick; // host is always players[0] (see server)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{ marginTop: '0', marginBottom: '5px', color: 'white', textDecoration: 'underline', cursor: 'pointer' }}
          onClick={() => tools.emit('leaveGame')}
        >Back to Lobby</div>

        <div>Waiting for players...</div>

        <div className="uno-potCount" style={{ marginTop: '10px', color: 'gold' }}>
          Total Pot: ${players.length * currSession.betAmount}
        </div>

        <ul style={{ marginTop: '20px', listStyle: 'none', padding: 0 }} className="joinedPlayers">
          {players.map((nick) => (
            <div key={nick} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <span>{nick}</span>
              {isHost && nick !== myNick ? (
                <button className="stdBtn smallBtn" onClick={() => tools.emit('kickPlayer', nick)}>kick</button>
              ) : null}
            </div>
          ))}
        </ul>

        {isHost ? (
          <button style={{ marginTop: '20px' }} className="stdBtn startGame" onClick={() => tools.emit('startGame')}>
            Start game
          </button>
        ) : <div style={{ marginTop: '20px', color: '#888' }}>Waiting for host to start…</div>}
      </div>
    );
  }
}

// ─── UNOLobby (create game) ──────────────────────────────────────────────────

class UNOLobby extends React.Component {
  render() {
    const { tools, setView } = this.props;
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ marginBottom: '10px' }}>
          <p
            className="backLobby"
            style={{ marginTop: '0', color: 'white', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => setView('menu')}
          >Back to Lobby</p>
        </div>

        <form
          style={{ display: 'flex', flexDirection: 'column', flex: '1', width: '75%' }}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            tools.emit('createGame', {
              sessionName: formData.get('sessionName'),
              betAmount: formData.get('betAmount')
            });
          }}
        >
          Session name
          <input name="sessionName" style={{ marginTop: '8px' }} className="stdInput sessionName" placeholder="Session name.." />

          <br />
          Betting
          <input name="betAmount" style={{ marginTop: '8px' }} type="number" min="0" step="1" className="stdInput betAmount" placeholder="Free game.." />

          <button type="submit" className="stdBtn makeSession" style={{ marginTop: '15px' }}>Init game</button>
        </form>
      </div>
    );
  }
}

// ─── UNOMenu (session list) ──────────────────────────────────────────────────

class UNOMenu extends React.Component {
  componentDidMount() {
    this.props.restartGame();
    this.props.tools.emit('getSessions');
  }

  render() {
    const { sessions, setView, watchGame, tools, balance } = this.props;
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <h2 style={{ marginTop: '0' }}>UNO sessions</h2>

        <div style={{ color: 'gold', fontSize: '13px' }}>Your coins: ₵{balance ?? 0}</div>

        <button
          className="stdBtn createSession"
          style={{ width: '75%', marginTop: '20px', backgroundColor: '#4caf50', display: 'flex', justifyContent: 'center' }}
          onClick={() => setView('lobby')}
        >Create new game</button>

        <table style={{ marginTop: '20px', flex: '1', width: '100%' }}>
          <thead>
            <tr>
              <th colSpan="1" style={{ borderBottom: '1px solid #555' }}>Bet</th>
              <th colSpan="1" style={{ borderBottom: '1px solid #555' }}>Name</th>
              <th colSpan="1" style={{ borderBottom: '1px solid #555' }}></th>
            </tr>
          </thead>
          <tbody className="sessionList">
            {Object.entries(sessions).map(([sessionName, sessionData]) => (
              <tr key={sessionName}>
                <td>{sessionData.betAmount}</td>
                <td>{sessionName}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="stdBtn smallBtn"
                    onClick={() => {
                      if (sessionData.gameState == 'pendingUsers') {
                        tools.emit('joinGame', sessionName);
                      } else {
                        watchGame([sessionName, sessionData]);
                      }
                    }}
                  >{sessionData.gameState == 'pendingUsers' ? 'Join' : 'Watch'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

// ─── UNOReact (controller) ───────────────────────────────────────────────────

class UNOReact extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      view: 'menu',
      players: [],
      currentSession: {},
      sessions: {},
      balance: 0
    };
    this.pendingGame = props.lobby;
    this.views = { menu: UNOMenu, lobby: UNOLobby, waitLobby: UNOWaitLobby, game: UNOGame };
  }

  componentDidMount() {
    const { tools, myNick } = this.props;

    this.balanceEvent = tools.on('balance', (balance) => this.setState({ balance }));

    this.playerLeftEvent = tools.on('playerLeft', ({ nick, sessionName }) => {
      if (sessionName === this.state.currentSession.sessionName) {
        const players = this.state.players;
        const playerIndex = players.indexOf(nick);
        if (playerIndex !== -1) {
          if (nick == myNick) {
            this.setState({ view: 'menu' });
          } else {
            players.splice(playerIndex, 1);
            this.setState({ players });
          }
        }
      }
    });

    this.handLengthEvent = tools.on('handLength', ({ sessionName, handLength }) => {
      if (sessionName === this.state.currentSession.sessionName) {
        this.setState({ handLength });
      }
    });

    this.gameOverEvent = tools.on('gameOver', ({ sessionName }) => {
      if (this.state.currentSession.sessionName === sessionName) {
        this.setState({ view: 'menu' });
      }
    });

    this.currentCardEvent = tools.on('currentCard', (data) => {
      if (data.sessionName == this.state.currentSession.sessionName) {
        this.setState({ turn: data.turn, card: data.card, drew: false, drawSize: data.drawSize });
      }
    });

    this.startingGameEvent = tools.on('startingGame', (sessionName) => {
      if (sessionName === this.state.currentSession.sessionName) {
        this.setState({ view: 'game' });
      }
    });

    this.yourdataEvent = tools.on('yourdata', (data) => {
      this.setState({ hand: data.hand, drew: data.drew });
    });

    this.playersEvent = tools.on('players', (players) => this.setState({ players }));

    this.sessionsEvent = tools.on('sessions', (sessions) => {
      if (this.pendingGame) {
        if (sessions[this.pendingGame] && sessions[this.pendingGame].gameState == 'pendingUsers') {
          tools.emit('joinGame', this.pendingGame);
        }
        this.pendingGame = null;
      } else {
        this.setState({ sessions });
      }
    });

    this.playerJoinedEvent = tools.on('playerJoined', ({ nick, sessionName, betAmount }) => {
      this.setState((prev) => {
        const add = (list) => (list.includes(nick) ? list : [...list, nick]);

        // my own join/create → enter the wait lobby and include myself
        if (nick === myNick) {
          return {
            currentSession: { sessionName, betAmount },
            view: 'waitLobby',
            players: add(prev.players)
          };
        }

        // someone else joined a session I'm in → add them
        if (sessionName === prev.currentSession.sessionName) {
          return { players: add(prev.players) };
        }

        return null;
      });
    });

    tools.emit('getSessions');
  }

  componentWillUnmount() {
    const { tools } = this.props;
    tools.removeEvent(this.balanceEvent);
    tools.removeEvent(this.playerLeftEvent);
    tools.removeEvent(this.handLengthEvent);
    tools.removeEvent(this.gameOverEvent);
    tools.removeEvent(this.currentCardEvent);
    tools.removeEvent(this.startingGameEvent);
    tools.removeEvent(this.yourdataEvent);
    tools.removeEvent(this.playersEvent);
    tools.removeEvent(this.sessionsEvent);
    tools.removeEvent(this.playerJoinedEvent);
    tools.emit('leaveGame');
  }

  watchGame(session) {
    this.setState({
      currentSession: { sessionName: session[0], betAmount: session[1].betAmount, watching: true },
      view: 'game',
      players: session[1].players
    });
  }

  restartGame() {
    this.setState({ players: [], currentSession: {}, handLength: null });
  }

  render() {
    const View = this.views[this.state.view];
    return (
      <View
        tools={this.props.tools}
        myNick={this.props.myNick}
        balance={this.state.balance}
        watchGame={(a) => this.watchGame(a)}
        restartGame={() => this.restartGame()}
        handLength={this.state.handLength}
        card={this.state.card}
        turn={this.state.turn}
        drew={this.state.drew}
        hand={this.state.hand}
        drawSize={this.state.drawSize}
        sessions={this.state.sessions}
        currSession={this.state.currentSession}
        players={this.state.players}
        setView={(view) => this.setState({ view })}
      />
    );
  }
}

// ─── UnoPanel (floating draggable shell, rebuilds PanelVieww) ─────────────────

function UnoPanel({ socket, user, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const panel = panelRef.current;
    let dragging = false, startX, startY, initX, initY;

    function onMouseDown(e) {
      // don't hijack clicks on interactive elements
      if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.nodeName)) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initX = rect.left; initY = rect.top;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    function onMouseMove(e) {
      if (!dragging) return;
      panel.style.left = (initX + e.clientX - startX) + 'px';
      panel.style.top = (initY + e.clientY - startY) + 'px';
    }
    function onMouseUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    panel.addEventListener('mousedown', onMouseDown);
    return () => panel.removeEventListener('mousedown', onMouseDown);
  }, []);

  // tools shim: prefix every event with `uno:` so ported logic uses bare names
  const tools = useRef({
    emit: (event, data) => socket.emit('uno:' + event, data),
    on: (event, cb) => socket.on('uno:' + event, cb),
    removeEvent: (unsub) => { if (typeof unsub === 'function') unsub(); }
  }).current;

  const myNick = user?.nick || (typeof window !== 'undefined' && window.store ? window.store.get('nick') : undefined);

  return (
    <div ref={panelRef} style={{
      position: 'fixed', top: '80px', left: '80px', zIndex: 9999,
      width: '300px', maxHeight: '370px', display: 'flex', flexDirection: 'column',
      background: '#1b1b1b', color: '#fff',
      borderRadius: '6px', boxShadow: '0 6px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', cursor: 'move',
        background: '#1b1b1b', userSelect: 'none'
      }}>
        <span style={{ fontWeight: 'bold' }}>UNO</span>
        <button
          className="stdBtn smallBtn"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
          onClick={onClose}
        >✕</button>
      </div>

      <div style={{ padding: '10px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <UNOReact tools={tools} myNick={myNick} />
      </div>
    </div>
  );
}

export default UnoPanel;
