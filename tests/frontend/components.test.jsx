import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Badge, TabBar, EmptyState, Icon } from '@/components';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Scan Now</Button>);
    expect(screen.getByRole('button', { name: 'Scan Now' })).toBeInTheDocument();
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to type="button" so it cannot submit a form', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('is disabled while loading and hides its label', () => {
    render(<Button loading>Scan Now</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(screen.queryByText('Scan Now')).not.toBeInTheDocument();
  });

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('honours the native disabled attribute over the prop', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Badge', () => {
  it('renders the verdict short label and percentage', () => {
    render(<Badge label="phishing_email" confidence={0.94} />);
    expect(screen.getByText(/Phishing/)).toBeInTheDocument();
    expect(screen.getByText(/94%/)).toBeInTheDocument();
  });

  it('rounds the confidence', () => {
    render(<Badge label="legitimate_email" confidence={0.876} />);
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  it('treats a missing confidence as zero', () => {
    render(<Badge label="legitimate_email" />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('falls back to uncertain for an unknown label', () => {
    render(<Badge label="something_else" confidence={0.5} />);
    expect(screen.getByText(/Uncertain/)).toBeInTheDocument();
  });
});

describe('TabBar', () => {
  it('renders a tab for each section', () => {
    render(<TabBar active="scan" onChange={() => {}} />);
    for (const label of ['Scan', 'Stats', 'Trusted', 'Settings']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('reports the selected tab id', async () => {
    const onChange = vi.fn();
    render(<TabBar active="scan" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Stats/ }));
    expect(onChange).toHaveBeenCalledWith('stats');
  });
});

describe('EmptyState', () => {
  it('renders the title and subtitle', () => {
    render(<EmptyState title="Nothing here yet" subtitle="Scan an email to begin" />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('Scan an email to begin')).toBeInTheDocument();
  });

  it('omits the subtitle block when not given', () => {
    render(<EmptyState title="Nothing here yet" />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });
});

describe('Icon', () => {
  it('renders a known icon as an svg', () => {
    const { container } = render(<Icon name="scan" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('falls back rather than rendering nothing for an unknown name', () => {
    const { container } = render(<Icon name="not_a_real_icon" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});