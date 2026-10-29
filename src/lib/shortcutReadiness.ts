export function shouldDeferShortcut(url: string, state: { userReady: boolean; locked: boolean; categoriesReady: boolean; walletsReady: boolean }): boolean {
  try {
    const parsed = new URL(url.startsWith('?') ? `https://accrual.internal/${url}` : url.replace(/^(?:accrual|trouvaille):\/\//i, 'https://accrual.internal/'));
    const path = parsed.pathname.replace(/^\/+/, '').toLowerCase();
    const keys = ['text', 'teks', 'title', 'q', 'ocr', 'content', 'amount', 'nominal'];
    const transaction = ['add', 'log', 'quick-log', 'transaction', 'capture'].includes(path) || parsed.searchParams.get('action') === 'add' || keys.some(key => parsed.searchParams.has(key));
    return transaction && (!state.userReady || state.locked || !state.categoriesReady || !state.walletsReady);
  } catch {
    return false;
  }
}
