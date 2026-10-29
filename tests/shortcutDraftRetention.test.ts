import { describe, it, expect, vi } from 'vitest';
import { getDraftBatches } from '../src/lib/draftTransactionService';

describe('pending shortcut drafts', () => {
  it('keeps unreviewed drafts older than seven days', () => {
    const batch = { id: 'old', createdAt: '2020-01-01T00:00:00Z', items: [{ id: 'item' }] };
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([batch]), setItem: vi.fn() });
    expect(getDraftBatches()).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
