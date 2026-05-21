import { useState, useEffect, useRef } from 'react';
import { NestMessage, messageParser, msgStyles } from './Messages';

const STYLE_TOKENS = [
  { token: '/*', label: 'B',  title: 'Bold' },
  { token: '/%', label: 'I',  title: 'Italic' },
  { token: '/!', label: '🌈', title: 'Rainbow' },
  { token: '/&', label: '〜', title: 'Wavy' },
  { token: '/$', label: '!',  title: 'Shake' },
  { token: '/+', label: '↺',  title: 'Spin' },
  { token: '/^', label: 'A+', title: 'Bigger' },
  { token: '/~', label: 'a-', title: 'Smaller' },
  { token: '/_', label: 'U̲',  title: 'Underline' },
  { token: '/@', label: '≈',  title: 'Blur' },
];

function emptyChar() {
  return { color: '', glow: '', styles: [] };
}

function extractFont(flair) {
  if (!flair || flair[0] !== '$') return '';
  const end = flair.indexOf('|');
  return end === -1 ? flair.slice(1) : flair.slice(1, end);
}

function isSegmentStart(flair, pos) {
  if (flair.slice(pos, pos + 3) === '###') return true;
  if (flair[pos] === '#' && /^[0-9a-fA-F]{6}|^[0-9a-fA-F]{3}/i.test(flair.slice(pos + 1))) return true;
  if (flair[pos] === '/' && STYLE_TOKENS.some(t => t.token === flair.slice(pos, pos + 2))) return true;
  return false;
}

function parseFlair(flair, nick) {
  if (!flair || !nick) return Array.from({ length: nick.length }, emptyChar);
  const charStyles = Array.from({ length: nick.length }, emptyChar);
  let nickPos = 0;
  let pos = 0;
  // skip font prefix ($FontName|)
  if (flair[0] === '$') {
    while (pos < flair.length && flair[pos] !== '|') pos++;
  }
  while (pos < flair.length && nickPos < nick.length) {
    while (pos < flair.length && flair[pos] === '|') pos++;
    if (pos >= flair.length) break;
    const styles = [];
    while (pos < flair.length - 1 && flair[pos] === '/') {
      const token = flair.slice(pos, pos + 2);
      if (STYLE_TOKENS.some(t => t.token === token)) { styles.push(token); pos += 2; }
      else break;
    }
    let glow = '';
    if (flair.slice(pos, pos + 3) === '###') {
      const m = flair.slice(pos + 3).match(/^[0-9a-fA-F]{6}|^[0-9a-fA-F]{3}/i);
      if (m) { glow = m[0]; pos += 3 + m[0].length; }
    }
    let color = '';
    if (flair[pos] === '#') {
      const m = flair.slice(pos + 1).match(/^[0-9a-fA-F]{6}|^[0-9a-fA-F]{3}/i);
      if (m) { color = m[0]; pos += 1 + m[0].length; }
    }
    const textStart = pos;
    // stop at '|' OR at the next segment marker (handles old format with no '|' between chars)
    while (pos < flair.length && flair[pos] !== '|' && !isSegmentStart(flair, pos)) pos++;
    const text = flair.slice(textStart, pos);
    for (let i = 0; i < text.length && nickPos < nick.length; i++, nickPos++) {
      charStyles[nickPos] = { color, glow, styles: [...styles] };
    }
  }
  return charStyles;
}

function sameChar(a, b) {
  return a.color === b.color && a.glow === b.glow &&
    a.styles.length === b.styles.length &&
    a.styles.every((s, i) => s === b.styles[i]);
}

function buildFlair(nick, charStyles, font = '') {
  if (!nick) return '';
  let result = font ? '$' + font : '';
  let segStart = 0;
  while (segStart < nick.length) {
    const s = charStyles[segStart] ?? emptyChar();
    let segEnd = segStart + 1;
    while (segEnd < nick.length && sameChar(charStyles[segEnd] ?? emptyChar(), s)) segEnd++;
    if (segStart > 0 || font) {
      const prevLen = segStart > 0 ? (charStyles[segStart - 1] ?? emptyChar()).styles.length : 0;
      result += '|'.repeat(Math.max(1, prevLen));
    }
    result += s.styles.join('');
    if (s.glow) result += '###' + s.glow;
    if (s.color) result += '#' + s.color;
    result += nick.slice(segStart, segEnd);
    segStart = segEnd;
  }
  return result;
}

function getCharDisplayStyle(cs) {
  if (!cs) return {};
  const style = {};
  if (cs.color) style.color = '#' + cs.color;
  else if (cs.glow) style.color = '#' + cs.glow;
  if (cs.glow) style.textShadow = `0 0 8px #${cs.glow}`;
  if (cs.styles.includes('/*')) style.fontWeight = 'bold';
  if (cs.styles.includes('/%')) style.fontStyle = 'italic';
  if (cs.styles.includes('/_')) style.textDecoration = 'underline';
  return style;
}

function FlairBuilder({ open, onClose, onApply, emojis, user }) {
  const nick = user?.nick ?? '';
  const [charStyles, setCharStyles] = useState(() => parseFlair(user?.flair, nick));
  const [font, setFont] = useState(() => extractFont(user?.flair));
  const [selection, setSelection] = useState(null);
  const dragStart = useRef(null);
  const [profiles, setProfiles] = useState([]);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    setCharStyles(Array.from({ length: nick.length }, emptyChar));
    setSelection(null);
  }, [nick]);

  useEffect(() => {
    if (open) {
      setCharStyles(parseFlair(user?.flair, nick));
      setFont(extractFont(user?.flair));
      setSelection(null);
      fetch('/a/profiles')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setProfiles(data); })
        .catch(() => {});
    }
  }, [open]);

  function handleSaveProfile() {
    const name = profileName.trim();
    if (!name || !flairStr) return;
    fetch('/a/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, flair: flairStr })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setProfiles(prev => {
            const idx = prev.findIndex(p => p.name === name);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { name, flair: flairStr };
              return updated;
            }
            return [...prev, { name, flair: flairStr }];
          });
        }
      });
  }

  function handleLoadProfile(profile) {
    const parsed = parseFlair(profile.flair, nick);
    setCharStyles(parsed);
    setFont(extractFont(profile.flair));
    setSelection(null);
  }

  function handleDeleteProfile(name) {
    fetch(`/a/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' })
      .then(() => setProfiles(prev => prev.filter(p => p.name !== name)));
  }

  const selRange = selection
    ? Array.from({ length: selection.end - selection.start }, (_, i) => selection.start + i)
    : [];

  function selHasStyle(token) {
    return selRange.length > 0 && selRange.every(i => charStyles[i]?.styles.includes(token));
  }

  function getUniformProp(prop) {
    if (selRange.length === 0) return '';
    const val = charStyles[selRange[0]]?.[prop] ?? '';
    return selRange.every(i => (charStyles[i]?.[prop] ?? '') === val) ? val : '';
  }

  function updateSel(patch) {
    if (!selection) return;
    setCharStyles(prev => prev.map((cs, i) =>
      i >= selection.start && i < selection.end ? { ...cs, ...patch } : cs
    ));
  }

  function toggleStyle(token) {
    if (!selection) return;
    const allHave = selHasStyle(token);
    setCharStyles(prev => prev.map((cs, i) => {
      if (i < selection.start || i >= selection.end) return cs;
      const styles = allHave
        ? cs.styles.filter(s => s !== token)
        : cs.styles.includes(token) ? cs.styles : [...cs.styles, token];
      return { ...cs, styles };
    }));
  }

  function onCharMouseDown(i, e) {
    e.preventDefault();
    dragStart.current = i;
    setSelection({ start: i, end: i + 1 });
  }

  function onCharMouseEnter(i) {
    if (dragStart.current === null) return;
    setSelection({
      start: Math.min(dragStart.current, i),
      end: Math.max(dragStart.current, i) + 1,
    });
  }

  function onMouseUp() {
    dragStart.current = null;
  }

  const flairStr = buildFlair(nick, charStyles, font);
  const parsed = messageParser.parse(flairStr, msgStyles);
  const curColor = getUniformProp('color');
  const curGlow = getUniformProp('glow');

  return (
    <div className={`flairBuilder${open ? ' open' : ''}`}>
      <div className='fb-header'>
        <span className='fb-title'>Flair Builder</span>
        <button className='fb-sel-all' onClick={() => setSelection({ start: 0, end: nick.length })}>
          Select All
        </button>
        <div className='fb-close' onClick={onClose}>✕</div>
      </div>

      <div className='fb-nick-display' onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        {nick.split('').map((char, i) => (
          <span
            key={i}
            className={`fb-char${selection && i >= selection.start && i < selection.end ? ' sel' : ''}`}
            style={getCharDisplayStyle(charStyles[i])}
            onMouseDown={e => onCharMouseDown(i, e)}
            onMouseEnter={() => onCharMouseEnter(i)}
          >
            {char}
          </span>
        ))}
        {!nick && <span className='fb-hint'>No nick set</span>}
      </div>

      {selection ? (
        <div className='fb-body'>
          <div className='fb-styles'>
            {STYLE_TOKENS.map(({ token, label, title }) => (
              <button
                key={token}
                title={title}
                className={`fb-style-btn${selHasStyle(token) ? ' on' : ''}`}
                onClick={() => toggleStyle(token)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className='fb-colors'>
            <div className='fb-color-row'>
              <span className='fb-color-label'>Color</span>
              <input type='color' className='fb-color-pick'
                value={curColor ? '#' + curColor : '#ffffff'}
                onChange={e => updateSel({ color: e.target.value.slice(1) })}
              />
              <input className='fb-hex' placeholder='hex' maxLength={6}
                value={curColor}
                onChange={e => updateSel({ color: e.target.value.replace(/[^0-9a-fA-F]/g, '') })}
              />
              {curColor && <span className='fb-clear' onClick={() => updateSel({ color: '' })}>✕</span>}
            </div>
            <div className='fb-color-row'>
              <span className='fb-color-label'>Glow</span>
              <input type='color' className='fb-color-pick'
                value={curGlow ? '#' + curGlow : '#ffffff'}
                onChange={e => updateSel({ glow: e.target.value.slice(1) })}
              />
              <input className='fb-hex' placeholder='hex' maxLength={6}
                value={curGlow}
                onChange={e => updateSel({ glow: e.target.value.replace(/[^0-9a-fA-F]/g, '') })}
              />
              {curGlow && <span className='fb-clear' onClick={() => updateSel({ glow: '' })}>✕</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className='fb-select-hint'>Click or drag to select characters</div>
      )}

      <div className='fb-profiles'>
        <div className='fb-section-label'>Profiles</div>
        <div className='fb-profile-save'>
          <input
            className='fb-profile-input'
            placeholder='Profile name...'
            maxLength={40}
            value={profileName}
            onChange={e => setProfileName(e.target.value)}
          />
          <button
            className='fb-profile-save-btn stdBtn'
            onClick={handleSaveProfile}
            disabled={!flairStr || !profileName.trim()}
          >Save</button>
        </div>
        {profiles.length > 0 && (
          <div className='fb-profile-list'>
            {profiles.map(p => (
              <div key={p.name} className='fb-profile-item'>
                <div className='fb-profile-preview' onClick={() => handleLoadProfile(p)}>
                  <NestMessage
                    message={messageParser.parse(p.flair, msgStyles)}
                    emojis={emojis || []}
                    _imageLoaded={() => {}}
                    renderMessage={() => null}
                    setOverlay={() => {}}
                  />
                  <span className='fb-profile-label'>{p.name}</span>
                </div>
                <span className='fb-profile-delete' onClick={() => handleDeleteProfile(p.name)}>✕</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='fb-footer'>
        <div className='fb-preview'>
          <NestMessage
            message={parsed}
            emojis={emojis || []}
            _imageLoaded={() => {}}
            renderMessage={() => null}
            setOverlay={() => {}}
          />
        </div>
        <div className='fb-raw'>{flairStr}</div>
        <button
          className='fb-apply stdBtn'
          onClick={() => { onApply(flairStr); onClose(); }}
          disabled={!flairStr}
        >
          Apply Flair
        </button>
      </div>
    </div>
  );
}

export default FlairBuilder;
