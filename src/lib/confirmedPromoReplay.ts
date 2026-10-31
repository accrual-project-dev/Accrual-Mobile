export function isConfirmedPromoReplay(note?: string | null): boolean {
 const text = (note || '').toLowerCase();
 return (text.includes('kak masih bisa klaim') && text.includes('shopeepay')) ||
   (text.includes('dana - dana - dana') && text.includes('siap-siap dapetin'));
}
