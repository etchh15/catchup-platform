import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import Navigation from './Navigation';
import { LanguageProvider } from '../i18n/LanguageContext';

function renderNavigation(props = {}) {
  return render(
    <LanguageProvider>
      <Navigation
        user={{ email: 'etchh0@gmail.com' }}
        profile={{}}
        role="admin"
        setRole={vi.fn()}
        activeTab="dashboard"
        setActiveTab={vi.fn()}
        onSignOut={vi.fn()}
        {...props}
      />
    </LanguageProvider>
  );
}

test('workspace nav badge uses workspace unread count instead of total notifications', () => {
  renderNavigation({
    unreadCount: 3,
    workspaceUnreadCount: 1,
    notifications: [
      { id: 'help-1', type: 'message_received', action_url: '/help', is_read: false },
      { id: 'workspace-1', type: 'message_received', action_url: '/workspace/room-1', is_read: false },
      { id: 'ops-1', type: 'verification_status', action_url: '/insights', is_read: false },
    ],
  });

  const workspaceButton = screen.getByRole('button', { name: /Workspace/i });
  expect(within(workspaceButton).getByText('1')).toBeInTheDocument();
  expect(screen.getByTitle('3 unread notifications')).toBeInTheDocument();
});
