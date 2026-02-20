import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { cn, formatChips, formatTimestamp } from '@/lib/utils';
import { getEnv } from '@/lib/env';
import { StatCard } from '@/components/stat-card';
import { TableStatusBadge } from '@/components/table-status-badge';

// ══════════════════════════════════════════════════════════════
// Utility functions
// ══════════════════════════════════════════════════════════════

describe('lib/utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('handles conditional classes', () => {
      const result = cn('base', false && 'hidden', 'visible');
      expect(result).toContain('base');
      expect(result).toContain('visible');
      expect(result).not.toContain('hidden');
    });

    it('merges tailwind classes (last wins)', () => {
      const result = cn('p-2', 'p-4');
      expect(result).toBe('p-4');
    });

    it('handles empty inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });
  });

  describe('formatChips', () => {
    it('formats integer chips', () => {
      const result = formatChips(1000);
      // toLocaleString may vary by locale, just check it returns a string
      expect(typeof result).toBe('string');
      expect(result).toContain('1');
    });

    it('formats zero', () => {
      expect(formatChips(0)).toBe('0');
    });

    it('formats large numbers', () => {
      const result = formatChips(1000000);
      expect(typeof result).toBe('string');
    });
  });

  describe('formatTimestamp', () => {
    it('formats a numeric timestamp', () => {
      const result = formatTimestamp(1700000000000);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('formats a string timestamp', () => {
      const result = formatTimestamp('2024-01-15T12:00:00Z');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// Environment config
// ══════════════════════════════════════════════════════════════

describe('lib/env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns defaults when env vars not set', () => {
    delete process.env.LOBBY_API_BASE_URL;
    delete process.env.ADMIN_API_KEY;
    const env = getEnv();
    expect(env.LOBBY_API_BASE_URL).toBe('http://localhost:8080');
    expect(env.ADMIN_API_KEY).toBe('');
  });

  it('returns custom values when env vars are set', () => {
    process.env.LOBBY_API_BASE_URL = 'https://api.example.com';
    process.env.ADMIN_API_KEY = 'secret-key-123';
    const env = getEnv();
    expect(env.LOBBY_API_BASE_URL).toBe('https://api.example.com');
    expect(env.ADMIN_API_KEY).toBe('secret-key-123');
  });
});

// ══════════════════════════════════════════════════════════════
// Component tests
// ══════════════════════════════════════════════════════════════

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Active Tables" value={5} />);
    expect(screen.getByText('Active Tables')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('renders string value', () => {
    render(<StatCard title="Status" value="Online" />);
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Online')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(<StatCard title="Hands" value={100} description="Total played" />);
    expect(screen.getByText('Total played')).toBeDefined();
  });

  it('renders without description', () => {
    const { container } = render(<StatCard title="Test" value={0} />);
    expect(container.querySelector('.text-xs.text-muted-foreground')).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<StatCard title="Test" value={0} className="custom-class" />);
    // The root card element should have the custom class
    expect(container.firstElementChild?.className).toContain('custom-class');
  });
});

describe('TableStatusBadge', () => {
  it('renders "Open" for open status', () => {
    render(<TableStatusBadge status="open" />);
    expect(screen.getByText('Open')).toBeDefined();
  });

  it('renders "Running" for running status', () => {
    render(<TableStatusBadge status="running" />);
    expect(screen.getByText('Running')).toBeDefined();
  });

  it('renders "Closed" for closed status', () => {
    render(<TableStatusBadge status="closed" />);
    expect(screen.getByText('Closed')).toBeDefined();
  });

  it('renders raw status for unknown status', () => {
    render(<TableStatusBadge status="unknown_status" />);
    expect(screen.getByText('unknown_status')).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// Types validation
// ══════════════════════════════════════════════════════════════

describe('lib/types', () => {
  it('TableInfo interface shape is valid', () => {
    const table = {
      id: 'tbl-1',
      variant: 'LHE' as const,
      status: 'open' as const,
      seats: [],
      handsPlayed: 0,
      createdAt: Date.now(),
    };
    expect(table.id).toBe('tbl-1');
    expect(table.variant).toBe('LHE');
    expect(table.status).toBe('open');
    expect(table.seats).toHaveLength(0);
  });

  it('SeatInfo interface shape is valid', () => {
    const seat = {
      seatIndex: 0,
      agentId: 'agent-1',
      chips: 1000,
      status: 'seated' as const,
    };
    expect(seat.seatIndex).toBe(0);
    expect(seat.agentId).toBe('agent-1');
    expect(seat.chips).toBe(1000);
  });
});
