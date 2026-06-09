import { expect, test } from 'vitest';
import { getJourneyState } from './JobJourneyStepper';

test('marks a closed completed workspace as final step done', () => {
  const journey = getJourneyState({
    task: {
      id: 'task-1',
      status: 'completed',
      work_delivered_at: '2026-06-07T10:00:00Z',
      confirmed_by_client_at: '2026-06-07T10:10:00Z',
    },
    room: { id: 'room-1', status: 'completed' },
    review: null,
  });

  expect(journey.current).toBe('completed');
  expect(journey.complete.delivered).toBe(true);
  expect(journey.complete.completed).toBe(true);
});

test('marks the final review and complete step done after the client review exists', () => {
  const journey = getJourneyState({
    task: {
      id: 'task-1',
      status: 'completed',
      work_delivered_at: '2026-06-07T10:00:00Z',
      confirmed_by_client_at: '2026-06-07T10:10:00Z',
    },
    room: { id: 'room-1', status: 'completed' },
    review: { id: 'review-1' },
  });

  expect(journey.current).toBe('completed');
  expect(journey.complete.completed).toBe(true);
});
