import { afterEach, expect, it, vi } from 'vitest';
import { saveDraftBatch } from '../src/lib/draftTransactionService';
import type { ParsedStatementItem } from '../src/lib/statementParser';
afterEach(() => vi.unstubAllGlobals());
it('does not overwrite draft storage when reading existing drafts fails', () => {
  const write = vi.fn();
  vi.stubGlobal('window', { dispatchEvent: () => true });
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('read failed'); }, setItem: write });
  expect(saveDraftBatch([{ id: 'new' } as ParsedStatementItem])).toBe('');
  expect(write).not.toHaveBeenCalled();
});
