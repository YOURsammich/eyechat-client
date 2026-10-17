import { useState } from 'react';
import PropTypes from 'prop-types';

// The Poll button's builder (feedback #106): a question, 2 to 10 answers and an
// optional time limit, turned into the /qpoll command and sent like a typed
// one. The server checks it all again; this only keeps the obvious mistakes
// (an empty answer, a comma or bar that would split one) from reaching it.

const MAX_ANSWERS = 10;
const LIMITS = [['', 'never'], ['1m', '1m'], ['5m', '5m'], ['1h', '1h']];

// Commas split answers and the bar ends the question, so neither may be typed.
const clean = (s) => s.replace(/[,|]/g, ' ').trim();

export function pollCommand(question, answers, limit) {
  const q = clean(question);
  const a = answers.map(clean).filter(Boolean);
  if (!q || a.length < 2) return null;
  return `/qpoll ${limit ? limit + ' ' : ''}${q}|${a.join(',')}`;
}

export default function PollBuilder({ onPost, onClose }) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState(['', '']);
  const [limit, setLimit] = useState('');

  const command = pollCommand(question, answers, limit);

  function setAnswer(i, value) {
    setAnswers(list => list.map((a, j) => (j === i ? value : a)));
  }

  function post(e) {
    e.preventDefault();
    if (!command) return;
    onPost(command);
    onClose();
  }

  return (
    <form className='pollBuilder' onSubmit={post}>
      <div className='pollBuilderHead'>
        <b>New poll</b>
        <button type='button' className='pollBuilderClose' onClick={onClose} aria-label='Close'>✕</button>
      </div>
      <input className='stdInput' placeholder='Question' maxLength={200} value={question}
        onChange={e => setQuestion(e.target.value)} autoFocus />
      {answers.map((a, i) => (
        <input key={i} className='stdInput' placeholder={'Answer ' + (i + 1)} maxLength={100} value={a}
          onChange={e => setAnswer(i, e.target.value)} />
      ))}
      {answers.length < MAX_ANSWERS
        ? <button type='button' className='pollBuilderAdd' onClick={() => setAnswers(list => [...list, ''])}>+ answer</button>
        : null}
      <div className='pollBuilderRow'>
        Closes
        <select value={limit} onChange={e => setLimit(e.target.value)}>
          {LIMITS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
        </select>
        <button type='submit' className='stdBtn' disabled={!command}>Post</button>
      </div>
    </form>
  );
}

PollBuilder.propTypes = {
  onPost: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
