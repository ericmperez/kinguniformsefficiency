import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import Message from './Message';

describe('Message Component', () => {
  it('should render hello message for Mateo', () => {
    render(<Message />);
    
    expect(screen.getByText('Hello Mateo')).toBeInTheDocument();
  });

  it('should render hello message with correct heading tag', () => {
    render(<Message />);
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Hello Mateo');
  });

  it('should have the name hardcoded as Mateo', () => {
    render(<Message />);
    
    // Since the name is hardcoded as "Mateo", it should always render the same message
    expect(screen.getByText(/Hello Mateo/)).toBeInTheDocument();
    expect(screen.queryByText(/Hellow World/)).not.toBeInTheDocument();
  });
});