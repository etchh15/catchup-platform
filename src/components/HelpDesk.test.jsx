import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import HelpDesk from './HelpDesk';
import {
  createHelpCase,
  fetchHelpCaseMessages,
  fetchHelpCases,
} from '../services/supabaseService';

vi.mock('../services/supabaseService', () => ({
  createHelpCase: vi.fn(),
  fetchHelpCaseMessages: vi.fn(),
  fetchHelpCases: vi.fn(),
  sendHelpCaseMessage: vi.fn(),
  updateHelpCaseStatus: vi.fn(),
}));

vi.mock('./Toast', () => ({
  useToast: () => vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const user = { id: 'user-1', email: 'client@example.com' };

test('client help desk hides status controls and focuses the new private case after submit', async () => {
  fetchHelpCases
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 'case-1',
        subject: 'Need help with a visit',
        status: 'open',
        category: 'job',
        priority: 'normal',
        last_message_at: '2026-06-10T12:00:00Z',
      },
    ]);
  fetchHelpCaseMessages.mockResolvedValue([
    {
      id: 'message-1',
      sender_id: 'user-1',
      sender_role: 'client',
      body: 'The specialist did not arrive.',
      created_at: '2026-06-10T12:00:00Z',
    },
  ]);
  createHelpCase.mockResolvedValue({ id: 'case-1' });

  render(<HelpDesk user={user} role="client" />);

  await waitFor(() => expect(fetchHelpCases).toHaveBeenCalledWith(expect.objectContaining({ status: 'all' })));
  expect(screen.queryByText('Waiting on user')).not.toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/Example: I need help with a proposal/i), {
    target: { value: 'Need help with a visit' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Write the details/i), {
    target: { value: 'The specialist did not arrive.' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Open private case/i }));

  expect(await screen.findByText(/Private case opened/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open private case/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Open another case/i })).toBeInTheDocument();
});

test('admin help desk keeps operator status filtering available', async () => {
  fetchHelpCases.mockResolvedValue([]);
  fetchHelpCaseMessages.mockResolvedValue([]);

  render(<HelpDesk user={{ id: 'admin-1', email: 'etchh0@gmail.com' }} role="admin" />);

  expect(await screen.findByRole('combobox')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Waiting on user' })).toBeInTheDocument();
  expect(fetchHelpCases).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
});
