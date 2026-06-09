import { expect, test } from 'vitest';
import { buildMarketplaceWorkflow } from './MarketplaceWorkflowPanel';

test('maps client marketplace data into an operational workflow', () => {
  const workflow = buildMarketplaceWorkflow({
    user: { id: 'client-1' },
    role: 'client',
    tasks: [
      { id: 'task-open', user_id: 'client-1', status: 'open' },
      {
        id: 'task-completed',
        user_id: 'client-1',
        status: 'completed',
        confirmed_by_client_at: '2026-06-07T10:00:00Z',
        work_delivered_at: '2026-06-07T09:30:00Z',
      },
    ],
    bids: [
      { id: 'bid-1', task_id: 'task-open', specialist_id: 'specialist-1', status: 'pending' },
    ],
    notifications: [{ id: 'notification-1', is_read: false }],
  });

  expect(workflow).toHaveLength(6);
  expect(workflow.find((stage) => stage.key === 'request').metric).toBe('1 pending');
  expect(workflow.find((stage) => stage.key === 'schedule').metric).toBe('1 alerts');
  expect(workflow.find((stage) => stage.key === 'closeout')).toMatchObject({
    title: 'Review & complete',
    state: 'urgent',
    action: 'Leave review',
    targetTab: 'messages',
  });
});

test('maps specialist accepted work to the workspace path', () => {
  const workflow = buildMarketplaceWorkflow({
    user: { id: 'specialist-1' },
    role: 'specialist',
    tasks: [{ id: 'task-active', specialist_id: 'specialist-1', status: 'active' }],
    bids: [{ id: 'bid-1', task_id: 'task-active', specialist_id: 'specialist-1', status: 'accepted' }],
    notifications: [],
  });

  expect(workflow.find((stage) => stage.key === 'match')).toMatchObject({
    metric: '1 deal rooms',
    state: 'active',
    action: 'Workspace',
    targetTab: 'messages',
  });
});
