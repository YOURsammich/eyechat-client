import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// Categorical series colors — dataviz dark-mode palette slots 1-5, validated
// against this page's dark surface. Index maps to the ranked top-5 nicks.
const COLORS = ['#3987e5', '#008300', '#d55181', '#c98500', '#199e70'];

function App() {
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null); // { term, nicks, totals, data }
  const [hidden, setHidden] = useState(() => new Set()); // nicks toggled off via the legend

  // Toggle a series in/out. Hidden lines are dropped from the Y-axis domain too,
  // so hiding an outlier rescales the chart and lets the rest be compared.
  function toggleNick(nick) {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(nick) ? next.delete(nick) : next.add(nick);
      return next;
    });
  }

  function flash(msg) {
    setStatus(msg);
    setTimeout(() => setStatus(''), 4000);
  }

  async function run() {
    const tv = term.trim();
    if (!tv) return flash('Enter a word or phrase.');
    setBusy(true);
    try {
      const res = await fetch('/wordstats/query?term=' + encodeURIComponent(tv));
      const data = await res.json();
      if (data && data.error) { setResult(null); return flash(data.error); }
      setHidden(new Set());
      setResult(data);
    } catch {
      flash('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const nicks = result?.nicks || [];
  const hasData = nicks.length > 0;

  return (
    <div className='wrap'>
      <header>
        <h1>Word trends</h1>
        <p>See who says a word or phrase the most, and how it trends month to month. &nbsp;</p>
      </header>

      <div className='card'>
        <h2>Search a word or phrase</h2>
        <div className='row'>
          <input placeholder='e.g. lol, good morning, cope' style={{ flex: 1, minWidth: 200 }}
            value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
          <button className='btn btn-primary' onClick={run} disabled={busy} style={{ minWidth: 90 }}>
            {busy ? <span className='spinner' aria-label='Searching' /> : 'Search'}
          </button>
        </div>
        {status ? <div className='status err'>{status}</div> : null}
      </div>

      {result && !hasData ? (
        <div className='card'><div className='empty'>No one has said “{result.term}” yet.</div></div>
      ) : null}

      {hasData ? (
        <>
          <div className='card chart-card'>
            <h2>“{result.term}” — top {nicks.length} by month</h2>
            <div className='chart-wrap'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart data={result.data} margin={{ top: 10, right: 20, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke='#2c2c2a' vertical={false} />
                  <XAxis dataKey='month' stroke='#2c2c2a' tick={{ fill: '#898781', fontSize: 12 }} />
                  <YAxis allowDecimals={false} stroke='#2c2c2a' tick={{ fill: '#898781', fontSize: 12 }} />
                  <Tooltip cursor={{ stroke: '#555' }} />
                  <Legend
                    onClick={(e) => toggleNick(e.dataKey)}
                    formatter={(value) => (
                      <span style={{ cursor: 'pointer', color: hidden.has(value) ? '#666' : '#ccc', textDecoration: hidden.has(value) ? 'line-through' : 'none' }}>{value}</span>
                    )}
                  />
                  {nicks.map((nick, i) => (
                    <Line key={nick} type='monotone' dataKey={nick} stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false}
                      hide={hidden.has(nick)} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className='card'>
            <h2>Total times said</h2>
            <div className='board'>
              {nicks.map((nick, i) => (
                <div className='board-row' key={nick}>
                  <span className='board-swatch' style={{ background: COLORS[i % COLORS.length] }}></span>
                  <span className='board-nick'>{nick}</span>
                  <span className='board-count'>{result.totals[nick].toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className='hint'>Occurrences across all chat history. Single words match whole words only; phrases match literally.</div>
          </div>
        </>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
