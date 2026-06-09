import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, test, expect, vi } from 'vitest';
import App from './App';

vi.mock('./hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('./hooks/useProfile', () => ({ useProfile: vi.fn() }));
vi.mock('./hooks/useMarketplaceData', () => ({ useMarketplaceData: vi.fn() }));
vi.mock('./hooks/useRealtimeSubscriptions', () => ({ useRealtimeSubscriptions: vi.fn() }));
vi.mock('./hooks/useNotifications', () => ({ useNotifications: vi.fn() }));

import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useMarketplaceData } from './hooks/useMarketplaceData';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';
import { useNotifications } from './hooks/useNotifications';

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});

function mockUnauthenticatedApp() {
  useAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });
  useProfile.mockReturnValue({ profile: null, role: null, loading: false, setupRole: vi.fn(), switchRole: vi.fn(), refreshProfile: vi.fn() });
  useMarketplaceData.mockReturnValue({ tasks: [], bids: [], specialists: [], syncData: vi.fn() });
  useRealtimeSubscriptions.mockImplementation(() => null);
  useNotifications.mockReturnValue({ notifications: [], unreadCount: 0, loading: false, markAsRead: vi.fn(), markAllAsRead: vi.fn(), clearAll: vi.fn() });
}

test('renders public beta landing when unauthenticated at the root route', () => {
  mockUnauthenticatedApp();

  render(<App />);

  expect(screen.getByRole('heading', { name: /Trusted local services/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Reserve beta spot/i })).toBeInTheDocument();
});

test('renders authentication gateway when unauthenticated at the auth route', () => {
  mockUnauthenticatedApp();
  window.history.replaceState({}, '', '/auth');

  render(<App />);

  expect(screen.getByText(/Welcome to CatchUp/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Sign in/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
});

test('lets authenticated users switch the platform navigation to Arabic', async () => {
  useAuth.mockReturnValue({ user: { id: 'user-1', email: 'client@example.com' }, loading: false, signOut: vi.fn() });
  useProfile.mockReturnValue({ profile: null, role: 'client', loading: false, setupRole: vi.fn(), switchRole: vi.fn(), refreshProfile: vi.fn() });
  useMarketplaceData.mockReturnValue({ tasks: [], bids: [], specialists: [], loading: false, error: null, syncData: vi.fn() });
  useRealtimeSubscriptions.mockImplementation(() => null);
  useNotifications.mockReturnValue({ notifications: [], unreadCount: 0, loading: false, markAsRead: vi.fn(), markAllAsRead: vi.fn(), clearAll: vi.fn() });

  render(<App />);

  screen.getByRole('button', { name: 'AR' }).click();

  expect(await screen.findByRole('button', { name: 'الرئيسية' })).toBeInTheDocument();
  expect(document.documentElement.dir).toBe('rtl');
});
