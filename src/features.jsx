import { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

import { TRUST_LABELS } from './comps/trustLevels';
import { ACTIVITIES, activityCommandNames } from './comps/activities';

// The public tour of the room: what Cope.chat does, what you can play, and every
// command in it. Unlike /search and /wordstats this page has no login gate — it
// is what someone reads before they have an account — so it never touches the
// log, only the two public registries /features/data serves.
//
// Split in two on purpose:
//   The showcase (SECTIONS below) is hand-written copy. It describes features
//   that are components and modules, not registry entries, so there is nothing
//   to enumerate — a card is added here when a feature ships.
//   The reference (COMMAND_NOTES plus the fetch) is generated from the live
//   registries, so a command added to commands.js appears without anyone
//   touching this file. The prose per command is optional; a command with no
//   note still lists.

// ─── Showcase copy ───────────────────────────────────────────────────────────
// `tags` are the commands, panels or tokens that reach the feature, shown as
// chips under the card. Written the way you would type them.

const SECTIONS = [
  {
    id: 'room',
    title: 'In the room',
    lede: 'The chat itself — what is happening on screen while people talk.',
    cards: [
      {
        icon: '🖱️',
        title: 'Live cursors',
        body: 'Every pointer in the room is drawn in everyone else’s window in real time, wearing whatever cursor its owner picked. It updates around 25 times a second and it is the fastest thing in the chat.',
        tags: ['Cosmetics → Cursor'],
      },
      {
        icon: '💬',
        title: 'Styled messages',
        body: 'Color, glow, font and effects are markup you type inline, or a style you set once and wear on everything you say. Greentext, quotes and nested replies are parsed as you would expect.',
        tags: ['Cosmetics → Message text'],
      },
      {
        icon: '🔗',
        title: 'Quote and jump',
        body: 'Every message has a number. Click a timestamp to quote it, click a quote to expand the message it points at without losing your place in the log.',
        tags: ['>>1234', '/whosaid'],
      },
      {
        icon: '😀',
        title: 'Emoji, GIFs and uploads',
        body: 'A shared emoji set the room adds to itself, a GIF picker, and image uploads that post inline.',
        tags: [':copium:'],
      },
      {
        icon: '✉️',
        title: 'Private messages',
        body: 'A PM opens its own window alongside the chat rather than taking over the main log, so a side conversation does not cost you the room.',
        tags: ['/pm'],
      },
      {
        icon: '🌊',
        title: 'Animated backgrounds',
        body: 'A WebGL fluid background that reacts to your pointer, with per-channel palettes — or a flat theme color if you would rather it sat still.',
        tags: ['/background', '/theme'],
      },
      {
        icon: '🗂️',
        title: 'Multi-tab, one identity',
        body: 'Open the chat in as many tabs or devices as you like. They are one person in the userlist, and every one of them receives the room.',
        tags: [],
      },
      {
        icon: '🌤️',
        title: 'Odds and ends',
        body: 'Pull a weather report into the chat, or set an away message that shows beside your nick.',
        tags: ['/weather', '/afk'],
      },
    ],
  },
  {
    id: 'cosmetics',
    title: 'Make it yours',
    lede: 'Six things about your presence are yours to build — and you can save whole looks as profiles and switch between them.',
    cards: [
      {
        icon: '🔤',
        title: 'Nick flair',
        body: 'Color, glow and style every character of your nick individually. The builder is per-letter, so a two-tone or gradient nick is a few clicks rather than a markup puzzle.',
        tags: ['/flair'],
      },
      {
        icon: '🧑',
        title: 'Avatars',
        body: 'Three ways in: compose one from a parts library, draw one pixel by pixel, or use an emoji. The freeform composer treats imported art as movable, resizable, rotatable layers with a brush on top.',
        tags: ['/avatar'],
      },
      {
        icon: '🎩',
        title: 'Hats',
        body: 'A hat sits above your nick on every message you send. Some are picked from the drawer; the rare ones have to be found.',
        tags: ['/hat'],
      },
      {
        icon: '👋',
        title: 'Leave messages',
        body: 'Write what the room sees when you disconnect, so you get an exit line instead of a silent departure.',
        tags: ['/part'],
      },
      {
        icon: '🎨',
        title: 'Chrome and layout',
        body: 'The top bar, input bar, menu, icon bar and message bubbles each take their own color, and the layout, message height and join/leave noise are all yours to set.',
        tags: ['/theme', '/sidebar'],
      },
      {
        icon: '💾',
        title: 'Style profiles',
        body: 'Save a whole look — flair, avatar, hat, cursor, text style, leave message — and apply it later. The header tells you when your live look has drifted from the saved one.',
        tags: [],
      },
    ],
  },
  {
    id: 'games',
    title: 'Games and coins',
    lede: 'Coins are one balance across everything below. You earn them by being here, and spend them on other people.',
    cards: [
      {
        icon: '🃏',
        title: 'UNO',
        wide: true,
        body: 'Match the top card by color or number, drop a draw-four on whoever is next, and call UNO when you are down to your last card. Everyone can put coins into a pot before the deal, and whoever goes out first takes the lot.',
        tags: [],
      },
      {
        icon: '💣',
        title: 'Shared minesweeper',
        wide: true,
        body: 'One 50×30 grid and everyone in the room clicking on it at the same time. A flag on a mine is +1, a flag on a safe cell is −1, and setting off a mine is −10 — but the map carries on, and when it is cleared a fresh one spawns. Drop in whenever; scores reset with each map.',
        tags: [],
      },
      {
        icon: '🖊️',
        title: 'Collaborative whiteboard',
        wide: true,
        body: 'One board the whole room can see, and a single marker. Whoever asks first gets to draw; when they put it down — or five minutes after somebody else asks for a turn — it passes to the next person waiting. Whatever gets drawn stays up until someone clears it.',
        tags: [],
      },
      {
        icon: '🎩',
        title: 'Hat drops',
        body: 'Every message you send rolls for a hat. Three tiers, and the top two pay coins alongside the hat. The hat is worn by the single message that won it and nothing after — equipping it is up to you.',
        tags: [],
      },
      {
        icon: '🔮',
        title: 'Magic Cope Ball',
        body: 'Ask it anything. The answer is a random pull from a pool the room wrote itself — vetted users add new ones, and the question is pure flavor.',
        tags: ['/ask', '/addcope'],
      },
      {
        icon: '💰',
        title: 'Coins',
        body: 'One wallet, spent in the curse shop and paid out by hat drops and UNO. You can send coins to anyone, and your balance stays live in the menu.',
        tags: ['/pay'],
      },
      {
        icon: '👊',
        title: 'Small violence',
        body: 'Flip a coin, punch someone (no damage is done), or — if you are an admin — arm a jump scare that waits for the target to leave the tab and come back.',
        tags: ['/flipcoin', '/punch', '/scare'],
      },
    ],
  },
  {
    id: 'curses',
    title: 'Curses',
    lede: 'MWs are bought with coins and stuck to someone else. Each wears off after a set number of messages — or the victim can pay to shake it off early.',
    curses: true,
  },
  {
    id: 'tools',
    title: 'Tools',
    lede: 'The parts of the room that are less about talking.',
    cards: [
      {
        icon: '🔍',
        title: 'Log search',
        body: 'Search the whole archive by text and by nick, shown as cards or rendered as real chat. Available from the search bar in chat, and as its own page.',
        tags: ['/search'],
      },
      {
        icon: '📈',
        title: 'Word trends',
        body: 'Track how often a word has been said over time, with a leaderboard of who says it most.',
        tags: ['/wordstats'],
      },
      {
        icon: '🧮',
        title: 'Pixel canvas',
        body: 'A pixel-art painting surface, shared by the avatar and emoji builders and usable on its own.',
        tags: [],
      },
      {
        icon: '⌨️',
        title: 'Code runner',
        body: 'A resizable pane that runs a plugin next to the chat, so you can build something for the room without leaving it.',
        tags: [],
      },
      {
        icon: '📮',
        title: 'Feedback board',
        body: 'Post an idea or a bug and watch it move. When something ships it lands in the What’s New notice in chat, beside the hand-written changelog.',
        tags: ['/feedback'],
      },
      {
        icon: '🎲',
        title: 'Join names',
        body: 'Guests get a random nick built from word lists the room stocks itself — adjectives and nouns anyone logged in can add to.',
        tags: [],
      },
    ],
  },
  {
    id: 'safety',
    title: 'Moderation and safety',
    lede: 'Trust levels run the whole room: lower numbers can do more, and an admin can retune what any single command asks for.',
    cards: [
      {
        icon: '🚫',
        title: 'Blocking, both ways',
        body: 'Block someone yourself and stop seeing them. A moderator can also offer two people who are arguing the option to stop seeing each other — it imposes nothing, both sides choose, and either can lift it.',
        tags: ['/block', '/separate'],
      },
      {
        icon: '🛡️',
        title: 'Whitelist mode',
        body: 'A channel can be closed to unvetted accounts, so a raid stops at the door without the room going quiet for everyone already in it.',
        tags: ['/whitelist'],
      },
      {
        icon: '🕵️',
        title: 'Proxy and Tor detection',
        body: 'Connections through VPNs, residential proxies and Tor exits are flagged in the userlist for staff, and can be refused outright at a setting the room picks.',
        tags: ['/proxyblock', '/proxyscan'],
      },
      {
        icon: '🔒',
        title: 'Retunable permissions',
        body: 'Every command and gated action carries the trust level it asks for, and an admin can change any of them live — including opening the log up to guests, or closing it further.',
        tags: ['/lock_command', '/trust'],
      },
      {
        icon: '🧹',
        title: 'Word filters',
        body: 'One word becomes another, room-wide. Anyone logged in can add one; removing is a moderator call.',
        tags: [],
      },
      {
        icon: '⏱️',
        title: 'Rate limits',
        body: 'Flood protection on messages and on the highest-frequency broadcasts, with a way for an admin to lift it temporarily when the room is being noisy on purpose.',
        tags: ['/nothrottle'],
      },
    ],
  },
];

// ─── Command reference copy ──────────────────────────────────────────────────
// One line per gated name, keyed exactly as the registry keys it (an ACTIONS key
// carries its ':'). Optional: a name with no entry lists with its params alone,
// which is what a newly added command looks like until someone writes a line.

const COMMAND_NOTES = {
  // Talking
  me: 'Post a line as an action rather than as speech.',
  msg: 'Send a message through the command instead of the input bar.',
  pm: 'Open a private conversation in its own window.',
  afk: 'Mark yourself away, with an optional reason shown beside your nick.',
  part: 'Set the message the room sees when you disconnect.',
  topic: 'Change the channel topic.',
  note: 'Post a note from staff.',

  // Look
  flair: 'Set the per-character color, glow and style of your nick.',
  avatar: 'Set one part of your composed avatar, or clear it with "none".',
  hat: 'Wear one of the hats you own.',
  background: 'Change the animated background palette.',
  theme: 'Recolor one piece of the chrome — top bar, input bar, menu, icon bar or bubbles.',
  sidebar: 'Show or hide the plugin bar for the whole room.',

  // Coins and play
  pay: 'Send coins to someone.',
  mw: 'Buy a curse and stick it on someone. Same catalog as the shop panel.',
  ask: 'Ask the Magic Cope Ball. The answer comes from the pool the room wrote.',
  addcope: 'Add an answer to the Magic Cope Ball pool.',
  flipcoin: 'Flip a coin in front of the room.',
  punch: 'Punch someone. Nothing happens to them.',
  scare: 'Arm a jump scare on someone — it waits for them to leave the tab and come back.',
  hatdrop: 'Force a hat drop for yourself, to see what one looks like.',

  // Account
  change_password: 'Change your password.',
  whois: 'Look up what is known about an account.',
  weather: 'Pull a weather report for a place into the chat.',

  // Living with people
  block: 'Stop seeing someone — for ten minutes, an hour, a day, or until you unblock them.',
  unblock: 'Lift a block you set.',
  separate: 'Offer two people the option to stop seeing each other. Each side decides for itself.',

  // Staff
  kick: 'Disconnect someone. They can come back.',
  ban: 'Ban an account, and the IPs it connects from.',
  banip: 'Ban an IP directly.',
  unban: 'Lift every ban for a nick or an IP.',
  trust: 'Set an account’s trust level.',
  lock_command: 'Change the trust level a command or action requires. Cannot be locked itself — it is the way back from every other lock.',
  whitelist: 'Turn whitelist mode on or off, closing the channel to unvetted accounts.',
  proxyblock: 'Set how connections through proxies and VPNs are handled.',
  proxyscan: 'Re-check what a user is connecting through.',
  nothrottle: 'Lift rate limits for a while.',
  find: 'Look up a user’s IP and every account created from it.',
  whosaid: 'Find out who sent a numbered message, and from where.',
  findmsg: 'Search the log for a phrase, from chat.',

  // Actions — no typed form; these are gated things done through the interface.
  'filter:add': 'Add a word filter, replacing one word with another room-wide.',
  'filter:remove': 'Remove a word filter.',
  'joinnick:add': 'Add a word to the lists a guest’s random nick is built from.',
  'joinnick:remove': 'Remove a word from those lists.',
  'log:scrollback': 'Scroll back past the live feed into the archive.',
  'log:search': 'Search the log from the search bar in chat.',
  'log:quote': 'Expand a quoted message to read what it points at.',
  'page:search': 'Open the standalone log search page.',
  'page:wordstats': 'Open the standalone word trends page.',
  'page:feedback': 'Open the feedback board.',
};

// The commands that open a game or a shared tool. These never reach the server
// — the chat handles them in the browser (see utils/handleInput.js, which builds
// the same list from the same registry) — so /features/data has never heard of
// them and they would otherwise be missing from a page that claims to list every
// command. Built here rather than hand-written so a new game appears on this
// page the moment it appears in the chat.
//
// `trust: null` is the literal truth: there is no gate, because there is no
// server round-trip to gate. That puts them in the "open to anyone" group with
// the other ungated commands, which is where a reader would look for them.
function activityCommands() {
  return ACTIVITIES.map(activity => {
    const [name, ...aliases] = activityCommandNames(activity);
    return {
      name,
      kind: 'client',
      label: '/' + name,
      trust: null,
      params: [],
      aliases,
      note: activity.blurb,
    };
  });
}

// One line on who is in each group, keyed by the trust number a command
// requires. 'null' is a command with no requirement at all — object keys are
// strings, so the lookup below stringifies before indexing.
const GROUP_NOTES = {
  null: 'No trust requirement at all.',
  5: 'Everyone, including guests and brand-new accounts.',
  4: 'Vetted regulars and above.',
  3: 'Between regular and moderator.',
  2: 'Moderators and above.',
  1: 'Admins and above.',
  0: 'Owners only.',
};

// Least privileged group first, so a reader scrolling down watches the room
// narrow. `null` (open to all) leads.
const GROUP_ORDER = [null, 5, 4, 3, 2, 1, 0];

function groupTitle(trust) {
  if (trust == null) return 'Open to anyone';
  const label = TRUST_LABELS[trust];
  return label ? `Trust ${trust} — ${label} and above` : `Trust ${trust} and above`;
}

// "1 in 10,000" reads better than "0.0001" for a rate nobody will ever hit.
function odds(chance) {
  return `1 in ${Math.round(1 / chance).toLocaleString()} messages`;
}

// ─── Components ──────────────────────────────────────────────────────────────

function FeatureCard({ card }) {
  return (
    <div className={'feature' + (card.wide ? ' wide' : '')}>
      <h3><span className='icon' aria-hidden='true'>{card.icon}</span>{card.title}</h3>
      <p>{card.body}</p>
      {card.tags?.length ? (
        <div className='tags'>
          {card.tags.map(t => <span key={t} className='tag'>{t}</span>)}
        </div>
      ) : null}
    </div>
  );
}

// The curse shop, straight from the middlewares catalog. Its own section rather
// than a card because the price and the duration are the point — five of them
// with the numbers buried in prose would be the wrong shape for comparing.
function Curses({ mws }) {
  if (!mws.length) return null;

  return (
    <div className='mwlist'>
      {mws.map(mw => (
        <div key={mw.id} className='mw'>
          <div className='mwHead'>
            <span className='mwName'>{mw.name}</span>
            <span className='mwLasts'>{mw.messages} messages</span>
            <span className='mwCost'>₵{mw.cost}</span>
          </div>
          <p>{mw.description}</p>
        </div>
      ))}
    </div>
  );
}

function Drops({ drops }) {
  return (
    <div className='drops'>
      {drops.map(d => (
        <div key={d.name} className='drop'>
          <div className='dropName'>{d.name}</div>
          <div className='dropOdds'>{odds(d.chance)}</div>
          {d.coins ? <div className='dropCoins'>+₵{d.coins.toLocaleString()}</div> : null}
        </div>
      ))}
    </div>
  );
}

function CommandRow({ cmd }) {
  // An activity command carries its own line (from the registry's blurb); every
  // other row looks its up in the page's own copy.
  const note = cmd.note ?? COMMAND_NOTES[cmd.name];

  return (
    <div className='cmd'>
      {cmd.kind === 'action'
        ? <span className='cmdName action'>{cmd.label}</span>
        : (
          <span className={'cmdName' + (cmd.kind === 'client' ? ' client' : '')}>
            /{cmd.name}
            {cmd.params.map(p => <span key={p} className='params'> &lt;{p}&gt;</span>)}
            {/* The short form people actually type, e.g. /wb for /whiteboard. */}
            {cmd.aliases?.length
              ? <span className='alias'> or /{cmd.aliases.join(', /')}</span>
              : null}
          </span>
        )}
      <span className='cmdDesc'>{note ?? <span style={{ color: '#666' }}>—</span>}</span>
    </div>
  );
}

// Every gated name, grouped by the level it currently requires. The filter box
// matches the typed name, an action's label and the prose, so "ban" finds /ban
// and "stop seeing" finds /block.
function Reference({ commands }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // The activity commands are merged in here rather than by the server, which
    // does not know they exist. They interleave alphabetically with the typed
    // commands — both are things you type, so splitting them would make a reader
    // check two lists for one name. Actions still sort last within a group: they
    // are italic phrases rather than commands, and mixing the two shapes into one
    // alphabetical run reads as noise.
    const actionLast = (c) => (c.kind === 'action' ? 1 : 0);
    const all = [...commands, ...activityCommands()]
      .sort((a, b) => actionLast(a) - actionLast(b) || a.name.localeCompare(b.name));

    const matches = all.filter(c => {
      if (kind !== 'all' && c.kind !== kind) return false;
      if (!needle) return true;
      const note = c.note ?? COMMAND_NOTES[c.name] ?? '';
      const haystack = `${c.name} ${c.label} ${(c.aliases ?? []).join(' ')} ${note}`.toLowerCase();
      return haystack.includes(needle);
    });

    return GROUP_ORDER
      .map(trust => ({ trust, rows: matches.filter(c => c.trust === trust) }))
      .filter(g => g.rows.length);
  }, [commands, q, kind]);

  return (
    <>
      <div className='cmdControls'>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder='Filter commands…'
          aria-label='Filter commands'
        />
        <select value={kind} onChange={e => setKind(e.target.value)} aria-label='Filter by kind'>
          <option value='all'>Everything</option>
          <option value='command'>Typed commands</option>
          <option value='client'>Games and tools</option>
          <option value='action'>Gated actions</option>
        </select>
      </div>

      {groups.length === 0
        ? <div className='empty'>Nothing matches that.</div>
        : groups.map(g => (
          <div key={String(g.trust)} className='cmdGroup'>
            <div className='cmdGroupHead'>
              <h3>{groupTitle(g.trust)}</h3>
              <span className='note'>{GROUP_NOTES[String(g.trust)]}</span>
            </div>
            {g.rows.map(c => <CommandRow key={c.kind + ':' + c.name} cmd={c} />)}
          </div>
        ))}
    </>
  );
}

function Features() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/features/data')
      .then(res => res.json())
      .then(setData)
      .catch(() => setError('Could not load the command list. Everything above it is still accurate.'));
  }, []);

  const commands = data?.commands ?? [];
  const mws = data?.mws ?? [];
  const drops = data?.hatDrops ?? [];

  // Everything a reader can actually type: the server's commands plus the ones
  // the chat handles itself. An ACTIONS entry is a permission rather than
  // something you can go and use, so folding those in would inflate the number.
  const commandCount = commands.filter(c => c.kind === 'command').length
    + (commands.length ? ACTIVITIES.length : 0);

  return (
    <div className='wrap features'>
      <div className='hero'>
        <h1>Everything Cope.chat does</h1>
        <p className='tagline'>
          A chat room that has been added to for a long time: live cursors, curses you
          buy with coins, hats you have to find, a whiteboard people take turns on, and
          a game of UNO the server deals itself.
        </p>
        <div className='cta'>
          <a className='btn btn-primary' href='/'>Open the chat</a>
          <a className='btn' href='#commands'>Command reference</a>
        </div>
        <div className='heroStats'>
          {commandCount ? <span><b>{commandCount}</b> commands</span> : null}
          {mws.length ? <span><b>{mws.length}</b> curses</span> : null}
          {drops.length ? <span><b>{drops.length}</b> hat drops</span> : null}
          <span><b>6</b> things to customise</span>
        </div>
      </div>

      <nav className='pagenav'>
        {SECTIONS.map(s => <a key={s.id} href={'#' + s.id}>{s.title}</a>)}
        <a href='#commands'>Commands</a>
      </nav>

      {error ? <div className='status err'>{error}</div> : null}

      {SECTIONS.map(section => (
        <section key={section.id} id={section.id} className='section'>
          <h2>{section.title}</h2>
          <p className='lede'>{section.lede}</p>

          {section.curses
            ? <Curses mws={mws} />
            : <div className='grid'>{section.cards.map(c => <FeatureCard key={c.title} card={c} />)}</div>}

          {/* The drop odds belong with the hat-drop card, and nowhere else. */}
          {section.id === 'games' && drops.length ? (
            <>
              <div className='cmdGroupHead' style={{ marginTop: 26 }}>
                <h3>Hat drop odds</h3>
                <span className='note'>Rolled on every message you send. Rarest first.</span>
              </div>
              <Drops drops={drops} />
            </>
          ) : null}
        </section>
      ))}

      <section id='commands' className='section'>
        <h2>Every command</h2>
        <p className='lede'>
          Read live from the server, so this is the list as it actually stands — including
          any level an admin has retuned. Alongside the typed commands are the ones that
          open a game or a shared tool — those are handled in your browser and never
          reach the server — and the gated actions: things you do through the interface
          that ask for a trust level in the same way, listed in italics.
        </p>
        {data ? <Reference commands={commands} /> : <div className='empty'>Loading…</div>}
      </section>

      <div className='foot'>
        Lower trust numbers can do more. Guests and new accounts start at 5, and an admin
        raises you from there.<br />
        <a href='/'>Back to chat</a>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Features />);
