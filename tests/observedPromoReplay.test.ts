import { expect, it } from 'vitest';
import { isPromotionalOrSpamNotification, parseBankNotification } from '../src/lib/bankNotificationParser';
it.each([
  'Kak masih bisa klaim ⏰ kak masih bisa klaim 500rb⏰ angka unik sesama shopeepay gampang kan!',
  'DANA - DANA - DANA\n🔥Siap-siap dapetin s',
])('rejects observed promotional replay: %s', text => {
  expect(isPromotionalOrSpamNotification(text)).toBe(true);
  expect(parseBankNotification(text)).toBeNull();
});
it('keeps an actual completed payment with a secondary savings note', () => {
  expect(isPromotionalOrSpamNotification('Pembayaran berhasil Rp 45.000. Kamu hemat Rp 5.000')).toBe(false);
});
