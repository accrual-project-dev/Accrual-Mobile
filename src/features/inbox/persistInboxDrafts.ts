import type { ParsedStatementItem } from '../../lib/statementParser';
import { getAllDraftItems, saveDraftBatch } from '../../lib/draftTransactionService';

export async function persistInboxDrafts(items: ParsedStatementItem[], title: string, ack: (ids: string[]) => Promise<unknown>): Promise<boolean> {
  const existingIds = new Set(getAllDraftItems().map(item => item.id));
  const newItems = items.filter(item => !existingIds.has(item.id));
  if (newItems.length && !saveDraftBatch(newItems, title, 'back_tap')) return false;
  await ack(items.map(item => item.id));
  return true;
}
