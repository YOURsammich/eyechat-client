import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Example of a client-side (jsdom + React Testing Library) test. Replace the
// inline component with a real import from ../components/... when testing UI.
function Greeting({ name }) {
  return <h1>Hello, {name}</h1>;
}

describe('client test pipeline', () => {
  it('renders a React component into jsdom', () => {
    render(<Greeting name="eyechat" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello, eyechat');
  });
});
