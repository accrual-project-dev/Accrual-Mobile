import type { ParsedStatementItem } from './statementParser';
export function isReviewItemValid(item: ParsedStatementItem): boolean {
  if (item.captureTimestampConfirmed === false) return false;
  if ('captureLedgerId' in item) {
    if (!item.captureLedgerId || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(item.time || '')) return false;
    const [year,month,day]=item.date.split('-').map(Number); const date=new Date(year,month-1,day);
    if(year<2000 || year>2100 || date.getFullYear()!==year || date.getMonth()+1!==month || date.getDate()!==day) return false;
  }
  if (!Number.isFinite(item.amount) || item.amount <= 0 || !item.walletId) return false;
  return item.type === 'transfer' ? !!item.destinationWalletId && item.destinationWalletId !== item.walletId : !!item.suggestedCategoryId;
}
