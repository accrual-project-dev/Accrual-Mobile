import { expect, it } from 'vitest';
import { parseDeepLink } from '../src/lib/deepLinkHandler';
import type { Category, Wallet } from '../src/lib/types';
const categories = [{ id: 'food', name: 'Food', type: 'expense' }] as Category[];
const wallets = [{ id: 'bca', name: 'BCA' }] as Wallet[];
it('does not automatically save an explicitly unmatched account or category', () => {
  const r = parseDeepLink('accrual://add?amount=12000&wallet=Unknown&category=Unknown&autosave=true', categories, wallets);
  expect(r.autoSave).toBe(false);
  expect(r.prefilledValues?.wallet_id).toBeUndefined();
  expect(r.prefilledValues?.category_id).toBeUndefined();
});
it('does not save a transfer back to the same account', () => {
  const r = parseDeepLink('accrual://add?amount=12000&type=transfer&wallet=BCA&to_wallet=BCA&autosave=true', categories, wallets);
  expect(r.autoSave).toBe(false);
  expect(r.requiresReview).toBe(true);
});
it('does not save when an account name is ambiguous', () => {
  const duplicate = [...wallets, { id: 'another', name: 'BCA' } as Wallet];
  const r = parseDeepLink('accrual://add?amount=12000&wallet=BCA&category=Food&autosave=true', categories, duplicate);
  expect(r.autoSave).toBe(false);
  expect(r.prefilledValues?.wallet_id).toBeUndefined();
});
it('does not automatically treat an unknown transaction type as expense', () => {
  const r = parseDeepLink('accrual://add?amount=12000&type=unknown&wallet=BCA&category=Food&autosave=true', categories, wallets);
  expect(r.autoSave).toBe(false);
  expect(r.requiresReview).toBe(true);
});
