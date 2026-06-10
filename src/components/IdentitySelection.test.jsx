import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import IdentitySelection from './IdentitySelection';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('requires an ID document before requesting specialist review', () => {
  const onSelectComplete = vi.fn();
  render(<IdentitySelection onSelectComplete={onSelectComplete} isLoading={false} />);

  fireEvent.click(screen.getByRole('button', { name: /Request specialist review/i }));

  expect(screen.getByText('Upload an ID document before requesting specialist review.')).toBeInTheDocument();
  expect(onSelectComplete).not.toHaveBeenCalled();
});

test('submits specialist review request with the selected ID document', () => {
  const onSelectComplete = vi.fn();
  const file = new File(['id'], 'national-id.png', { type: 'image/png' });
  render(<IdentitySelection onSelectComplete={onSelectComplete} isLoading={false} />);

  fireEvent.change(screen.getByLabelText(/Specialist ID document/i, { selector: 'input' }), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Request specialist review/i }));

  expect(onSelectComplete).toHaveBeenCalledWith('specialist', { idDocumentFile: file });
});
