import { expect, it } from 'vitest';
import { shouldDeferShortcut } from '../src/lib/shortcutReadiness';
it('waits for authentication, unlock, categories and wallets for transaction payloads', () => {
 const url = 'accrual://add?amount=50000&autosave=true';
 expect(shouldDeferShortcut(url, { userReady: false, locked: false, categoriesReady: true, walletsReady: true })).toBe(true);
 expect(shouldDeferShortcut(url, { userReady: true, locked: true, categoriesReady: true, walletsReady: true })).toBe(true);
 expect(shouldDeferShortcut(url, { userReady: true, locked: false, categoriesReady: false, walletsReady: true })).toBe(true);
 expect(shouldDeferShortcut(url, { userReady: true, locked: false, categoriesReady: true, walletsReady: true })).toBe(false);
});
it('does not delay navigation without a transaction payload', () => {
 expect(shouldDeferShortcut('accrual://scan', { userReady: true, locked: false, categoriesReady: false, walletsReady: false })).toBe(false);
});
