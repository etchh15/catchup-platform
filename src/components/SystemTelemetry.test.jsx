import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import SystemTelemetry from './SystemTelemetry';
import { fetchAdminEmergencySignals } from '../services/supabaseService';

vi.mock('../services/supabaseService', () => ({
  fetchAdminEmergencySignals: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

test('emergency console signals route admin to the correct operating surface', async () => {
  fetchAdminEmergencySignals.mockResolvedValue({
    openDisputes: 2,
    activeRooms: 3,
    staleOpenTasks: 1,
    pendingVerification: 4,
    betaWaitlist: 0,
    openAbuseEvents: 1,
    unpaidAcceptedWork: 2,
  });
  const setActiveTab = vi.fn();

  render(<SystemTelemetry setActiveTab={setActiveTab} />);

  await screen.findByText('Recommended admin action');
  fireEvent.click(screen.getAllByRole('button', { name: /Open disputes/i })[0]);

  expect(setActiveTab).toHaveBeenCalledWith('analytics', '#admin-disputes');

  fireEvent.click(screen.getAllByRole('button', { name: /Verification queue/i })[0]);
  expect(setActiveTab).toHaveBeenCalledWith('analytics', '#admin-verification');

  fireEvent.click(screen.getByRole('button', { name: /Active rooms/i }));
  expect(setActiveTab).toHaveBeenCalledWith('messages', undefined);
});
