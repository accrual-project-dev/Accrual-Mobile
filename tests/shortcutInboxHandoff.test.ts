import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistInboxDrafts } from '../src/features/inbox/persistInboxDrafts';
import { getAllDraftItems } from '../src/lib/draftTransactionService';
import type { ParsedStatementItem } from '../src/lib/statementParser';

const item = { id: 'capture-1', amount: 1000 } as ParsedStatementItem;
function storage(fail = false) {
  let data: string | null = null;
  vi.stubGlobal('window', { dispatchEvent: () => true });
  vi.stubGlobal('CustomEvent', class {});
  vi.stubGlobal('localStorage', { getItem: () => data, setItem: (_key: string, value: string) => { if (fail) throw new Error('storage full'); data = value; } });
}
afterEach(() => vi.unstubAllGlobals());
describe('native inbox handoff', () => {
  it('never acknowledges capture if saving fails', async () => {
    storage(true);
    const ack = vi.fn();
    await expect(persistInboxDrafts([item], 'Screenshot', ack)).resolves.toBe(false);
    expect(ack).not.toHaveBeenCalled();
  });
  it('acknowledges after persistence and does not duplicate on retry', async () => {
    storage();
    const ack = vi.fn().mockRejectedValueOnce(new Error('bridge')).mockResolvedValue(undefined);
    await expect(persistInboxDrafts([item], 'Screenshot', ack)).rejects.toThrow('bridge');
    expect(getAllDraftItems()).toHaveLength(1);
    await expect(persistInboxDrafts([item], 'Screenshot', ack)).resolves.toBe(true);
    expect(getAllDraftItems()).toHaveLength(1);
    expect(ack).toHaveBeenLastCalledWith(['capture-1']);
  });
});
