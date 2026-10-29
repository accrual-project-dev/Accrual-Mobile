import { expect, it } from 'vitest';
import { isReviewItemValid } from '../src/lib/shortcutReviewValidation';
import type { ParsedStatementItem } from '../src/lib/statementParser';
const item = { amount: 100, type: 'expense', walletId: 'w1', suggestedCategoryId: 'c1' } as ParsedStatementItem;
it('requires an explicitly selected account and category', () => {
 expect(isReviewItemValid({ ...item, walletId: null })).toBe(false);
 expect(isReviewItemValid({ ...item, suggestedCategoryId: null })).toBe(false);
 expect(isReviewItemValid(item)).toBe(true);
});
it('requires different explicit accounts for transfers', () => {
 expect(isReviewItemValid({ ...item, type: 'transfer', destinationWalletId: 'w1' })).toBe(false);
 expect(isReviewItemValid({ ...item, type: 'transfer', destinationWalletId: 'w2' })).toBe(true);
});
it('requires complete valid timestamps for captured drafts',()=>{
 const capture={...item,captureLedgerId:'personal',captureTimestampConfirmed:true,date:'2026-10-29',time:'10:30'};
 expect(isReviewItemValid(capture)).toBe(true);
 expect(isReviewItemValid({...capture,date:''})).toBe(false);
 expect(isReviewItemValid({...capture,date:'2026-02-31'})).toBe(false);
 expect(isReviewItemValid({...capture,time:''})).toBe(false);
});
